'use strict';
const crypto = require('node:crypto');

// Un agent = { name, token } (jeton 64 hex) et/ou { name, username, password } (connexion simple).
function configuredAgents(env) {
  const agents = env.BATIMAT_SCANNER_AGENTS
    ? JSON.parse(env.BATIMAT_SCANNER_AGENTS)
    : env.BATIMAT_SCANNER_TOKEN ? [{ name: 'Accueil', token: env.BATIMAT_SCANNER_TOKEN }] : [];
  const validToken = a => typeof a.token === 'string' && /^[a-f0-9]{64}$/i.test(a.token);
  const validLogin = a => typeof a.username === 'string' && a.username.trim().length >= 2 &&
    typeof a.password === 'string' && a.password.length >= 6;
  if (!Array.isArray(agents) || !agents.length || agents.some(a =>
    typeof a.name !== 'string' || !a.name.trim() || !(validToken(a) || validLogin(a)))) {
    throw new Error('Scanner agents not configured');
  }
  const tokens = agents.filter(a => a.token).map(a => a.token);
  const users = agents.filter(a => a.username).map(a => a.username.trim().toLowerCase());
  if (new Set(tokens).size !== tokens.length) throw new Error('Duplicate scanner token');
  if (new Set(users).size !== users.length) throw new Error('Duplicate scanner username');
  return agents;
}

const digest = value => crypto.createHash('sha256').update(String(value)).digest();
const same = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

// Anti-force brute : 10 échecs / 15 min par adresse IP (mots de passe simples).
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;
function makeLimiter(now = () => Date.now()) {
  const fails = new Map();
  const ipOf = req => (req.headers?.['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
    req.socket?.remoteAddress || 'unknown';
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
    ok(req) { fails.delete(ipOf(req)); },
  };
}

function findAgent(agents, header) {
  if (header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (!token || token.length > 512) return null;
    return agents.find(a => a.token && same(a.token, token)) || null;
  }
  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    if (i < 1 || decoded.length > 512) return null;
    const username = decoded.slice(0, i).trim().toLowerCase();
    const password = decoded.slice(i + 1);
    // On compare tous les comptes pour ne pas révéler si l'identifiant existe.
    let found = null;
    for (const a of agents) {
      if (!a.username) continue;
      const userOk = same(a.username.trim().toLowerCase(), username);
      const passOk = same(a.password, password);
      if (userOk && passOk) found = a;
    }
    return found;
  }
  return null;
}

function makeAuth(env = process.env, limiter = makeLimiter()) {
  return (req, res, next) => {
    let agents;
    try { agents = configuredAgents(env); }
    catch { return res.status(503).json({ message: 'Accès scanner non configuré sur le serveur.' }); }
    if (limiter.blocked(req)) {
      return res.status(429).json({ message: 'Trop de tentatives. Réessaie dans quelques minutes.' });
    }
    const agent = findAgent(agents, req.get('authorization') || '');
    if (!agent) {
      limiter.fail(req);
      return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
    }
    limiter.ok(req);
    req.scannerAgent = agent.name;
    res.set('Cache-Control', 'no-store');
    next();
  };
}
module.exports = makeAuth();
module.exports.makeAuth = makeAuth;
