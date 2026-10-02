'use strict';
const crypto = require('node:crypto');

function configuredAgents(env) {
  const agents = env.BATIMAT_SCANNER_AGENTS
    ? JSON.parse(env.BATIMAT_SCANNER_AGENTS)
    : env.BATIMAT_SCANNER_TOKEN ? [{ name: 'Accueil', token: env.BATIMAT_SCANNER_TOKEN }] : [];
  if (!Array.isArray(agents) || !agents.length || agents.some(a =>
    typeof a.name !== 'string' || !a.name.trim() || typeof a.token !== 'string' || !/^[a-f0-9]{64}$/i.test(a.token))) {
    throw new Error('Scanner agents not configured');
  }
  if (new Set(agents.map(a => a.token)).size !== agents.length) throw new Error('Duplicate scanner token');
  return agents;
}
function makeAuth(env = process.env) {
  return (req, res, next) => {
    let agents;
    try { agents = configuredAgents(env); }
    catch { return res.status(503).json({ message: 'Accès scanner non configuré sur le serveur.' }); }
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token || token.length > 512) return res.status(401).json({ message: 'Code d’accès invalide.' });
    const digest = value => crypto.createHash('sha256').update(value).digest();
    const agent = agents.find(a => crypto.timingSafeEqual(digest(a.token), digest(token)));
    if (!agent) return res.status(401).json({ message: 'Code d’accès invalide.' });
    req.scannerAgent = agent.name;
    res.set('Cache-Control', 'no-store');
    next();
  };
}
module.exports = makeAuth();
module.exports.makeAuth = makeAuth;
