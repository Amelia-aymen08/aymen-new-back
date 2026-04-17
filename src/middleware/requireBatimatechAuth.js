const db = require('../models');
const { verifyToken } = require('../utils/batimatechAuth');

module.exports = async function requireBatimatechAuth(req, res, next) {
  try {
    const authHeader = req.get('authorization') || '';
    const [, token] = authHeader.split(' ');

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentification requise.' });
    }

    const payload = verifyToken(token);
    if (!payload?.id) {
      return res.status(401).json({ success: false, message: 'Session invalide ou expirée.' });
    }

    const salesAgent = await db.SalesAgent.findByPk(payload.id);
    if (!salesAgent || !salesAgent.isActive) {
      return res.status(401).json({ success: false, message: 'Compte commercial introuvable ou inactif.' });
    }

    req.salesAgent = salesAgent;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Authentification invalide.' });
  }
};
