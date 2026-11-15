'use strict';
const db = require('../models');
const { verifyPassword } = require('../services/jpoAgentAuth');
const { signAdminToken } = require('../middleware/requireAdmin');

// Freine les essais de mot de passe : 10 échecs par IP et par quart d'heure.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const failures = new Map();

function tooManyFailures(ip) {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(ip) {
  const entry = failures.get(ip);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failures.set(ip, { first: Date.now(), count: 1 });
  else entry.count += 1;
}

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

exports.login = async (req, res) => {
  // Derrière le proxy Apache : la dernière adresse de X-Forwarded-For est celle ajoutée par Apache
  // (la première peut être inventée par le client).
  const ip = req.headers['x-forwarded-for']?.toString().split(',').pop()?.trim() || req.socket?.remoteAddress || 'unknown';
  if (tooManyFailures(ip)) {
    return res.status(429).json({ message: 'Trop de tentatives. Réessayez dans 15 minutes.' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ message: 'E-mail et mot de passe requis.' });

  const user = await db.AdminUser.findOne({ where: { email } });
  const ok = user && user.active && (await verifyPassword(password, user.passwordHash));
  if (!ok) {
    recordFailure(ip);
    return res.status(401).json({ message: 'E-mail ou mot de passe incorrect.' });
  }

  failures.delete(ip);
  await user.update({ lastLoginAt: new Date() });
  try {
    return res.json({ token: signAdminToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('[admin] login', err.message);
    return res.status(503).json({ message: 'Back-office non configuré (ADMIN_JWT_SECRET).' });
  }
};

exports.me = (req, res) => res.json({ user: publicUser(req.adminUser) });
