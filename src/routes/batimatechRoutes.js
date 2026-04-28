const express = require('express');
const router = express.Router();
const controller = require('../controllers/batimatechController');
const requireBatimatechAuth = require('../middleware/requireBatimatechAuth');

function requireBatimatechDashboardAuth(req, res, next) {
  const expected = process.env.BATIMATECH_ANALYTICS_TOKEN || process.env.BATIMATECH_DASHBOARD_TOKEN || null;
  if (!expected) {
    return res.status(503).json({ success: false, message: 'Accès dashboard non configuré.' });
  }

  const expectedNormalized = String(expected).trim();
  const authHeader = req.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const apiKey = String(req.get('x-api-key') || '').trim();
  const provided = (token || apiKey).trim();

  if (!provided) {
    return res.status(401).json({ success: false, message: 'Authentification dashboard requise.' });
  }
  if (provided !== expectedNormalized) {
    return res.status(401).json({ success: false, message: 'Authentification dashboard invalide.' });
  }

  next();
}

router.post('/login', controller.login);
router.get('/me', requireBatimatechAuth, controller.me);
router.get('/projects', requireBatimatechAuth, controller.listProjects);
router.get('/slots', requireBatimatechAuth, controller.listBookedSlots);
router.post('/leads', requireBatimatechAuth, controller.createLead);
router.get('/leads', requireBatimatechDashboardAuth, controller.listLeads);

module.exports = router;
