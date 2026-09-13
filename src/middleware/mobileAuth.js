const { verifyAccessToken } = require('../services/mobile/tokenService');
const db = require('../models');

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message, retryable: false } });
}

async function requireMobileAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return sendError(res, 401, 'SESSION_MISSING', 'Session absente ou expirée.');
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await db.MobileUser.findByPk(payload.sub);
    if (!user || user.status === 'deleted') {
      return sendError(res, 401, 'SESSION_MISSING', 'Session absente ou expirée.');
    }
    req.mobileUser = user;
    return next();
  } catch (err) {
    return sendError(res, 401, 'SESSION_EXPIRED', 'Session expirée, veuillez vous reconnecter.');
  }
}

module.exports = { requireMobileAuth };
