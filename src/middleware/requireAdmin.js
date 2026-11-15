'use strict';
const jwt = require('jsonwebtoken');
const db = require('../models');

const TOKEN_TTL = process.env.ADMIN_TOKEN_TTL || '12h';

function getSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  // Pas de secret par défaut : sans configuration, le back-office reste fermé.
  if (!secret || secret.length < 32) return null;
  return secret;
}

function signAdminToken(user) {
  const secret = getSecret();
  if (!secret) throw new Error('ADMIN_JWT_SECRET manquant ou trop court (32 caractères minimum).');
  return jwt.sign({ sub: user.id, role: user.role }, secret, { expiresIn: TOKEN_TTL });
}

/** Protège les routes /api/admin/* : « Authorization: Bearer <jeton> ». */
async function requireAdmin(req, res, next) {
  const secret = getSecret();
  if (!secret) {
    return res.status(503).json({ message: "Back-office non configuré (ADMIN_JWT_SECRET)." });
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Connexion requise.' });

  try {
    const payload = jwt.verify(token, secret);
    const user = await db.AdminUser.findByPk(payload.sub);
    if (!user || !user.active) return res.status(401).json({ message: 'Compte désactivé ou introuvable.' });
    req.adminUser = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'Session expirée, veuillez vous reconnecter.' });
  }
}

function requireAdminRole(req, res, next) {
  if (req.adminUser?.role !== 'admin') return res.status(403).json({ message: 'Réservé aux administrateurs.' });
  return next();
}

module.exports = { requireAdmin, requireAdminRole, signAdminToken };
