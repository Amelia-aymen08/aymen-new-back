const express = require('express');
const router = express.Router();
const batimatController = require('../controllers/batimatController');

function requireBatimatDashboardAuth(req, res, next) {
  const expected = process.env.BATIMAT_DASHBOARD_TOKEN || null;
  if (!expected) {
    return res.status(503).json({ message: 'Accès dashboard non configuré.' });
  }

  const authHeader = req.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const apiKey = String(req.get('x-api-key') || '').trim();
  const provided = (token || apiKey).trim();

  if (!provided || provided !== String(expected).trim()) {
    return res.status(401).json({ message: 'Authentification dashboard requise.' });
  }

  next();
}

router.post('/', batimatController.createLead);
router.get('/', requireBatimatDashboardAuth, batimatController.getAllLeads);
router.patch('/:id/statut', requireBatimatDashboardAuth, batimatController.updateStatus);

module.exports = router;
