'use strict';
const crypto = require('node:crypto');
const { verifyPassword } = require('../services/jpoAgentAuth');

// Auth de l'application de scan JPO Hélénite : « Authorization: Basic base64(e-mail:mot de passe) ».
// Chaque requête est vérifiée contre la table jpo_helenite_agents (compte actif obligatoire).
// Pose req.jpoAgent = { id, name, email, role }.

const MAX_FAILS = 10; // échecs par adresse IP et par fenêtre
const WINDOW_MS = 15 * 60 * 1000;
const VERIFIED_TTL_MS = 5 * 60 * 1000;

function makeLimiter(now = () => Date.now()) {
  const fails = new Map();
  const ipOf = (req) =>
    (req.headers?.['x-forwarded-for'] || '').toString().split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  return {
    blocked(req) {
      const entry = fails.get(ipOf(req));
      return !!entry && now() - entry.start < WINDOW_MS && entry.count >= MAX_FAILS;
    },
    fail(req) {
      const ip = ipOf(req);
      const entry = fails.get(ip);
      if (!entry || now() - entry.start >= WINDOW_MS) fails.set(ip, { start: now(), count: 1 });
      else entry.count += 1;
      if (fails.size > 5000) for (const [k, v] of fails) if (now() - v.start >= WINDOW_MS) fails.delete(k);
    },
    ok(req) {
      fails.delete(ipOf(req));
    },
  };
}

function parseBasic(header) {
  if (!header.startsWith('Basic ')) return null;
  const decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
  const i = decoded.indexOf(':');
  if (i < 1 || decoded.length > 512) return null;
  return { email: decoded.slice(0, i).trim().toLowerCase(), password: decoded.slice(i + 1) };
}

// `findAgent(email)` -> ligne agent ou null ; injectable pour les tests.
function makeAuth({ findAgent, touchLogin, limiter = makeLimiter(), now = () => Date.now() } = {}) {
  // scrypt coûte ~50 ms : un mot de passe déjà vérifié est mémorisé quelques minutes (clé = hash stocké + mot de passe,
  // donc un changement de mot de passe l'invalide aussitôt).
  const verified = new Map();

  return async (req, res, next) => {
    try {
      if (limiter.blocked(req)) {
        return res.status(429).json({ message: 'Trop de tentatives. Réessaie dans quelques minutes.' });
      }
      const creds = parseBasic(req.get('authorization') || '');
      const agent = creds ? await findAgent(creds.email) : null;
      let ok = false;
      if (agent && agent.active) {
        const key = crypto.createHash('sha256').update(`${agent.passwordHash}\n${creds.password}`).digest('hex');
        const hit = verified.get(key);
        if (hit && hit > now()) ok = true;
        else if (await verifyPassword(creds.password, agent.passwordHash)) {
          ok = true;
          verified.set(key, now() + VERIFIED_TTL_MS);
          if (verified.size > 500) for (const [k, v] of verified) if (v <= now()) verified.delete(k);
          if (touchLogin) touchLogin(agent).catch(() => {});
        }
      } else if (creds) {
        // Même coût de calcul si le compte n'existe pas : on ne révèle pas quels e-mails existent.
        await verifyPassword(creds.password, 'scrypt$00$00').catch(() => false);
      }
      if (!ok) {
        limiter.fail(req);
        return res.status(401).json({ message: 'E-mail ou mot de passe incorrect.' });
      }
      limiter.ok(req);
      req.jpoAgent = { id: agent.id, name: agent.name, email: agent.email, role: agent.role };
      res.set('Cache-Control', 'no-store');
      return next();
    } catch (error) {
      console.error('[jpo-scanner] auth:', error.name || 'Error');
      return res.status(503).json({ message: 'Authentification indisponible.' });
    }
  };
}

module.exports = { makeAuth, makeLimiter, parseBasic };
