'use strict';
const express = require('express');
const { Op, QueryTypes } = require('sequelize');
const { BatimatAfterRegistration: model, sequelize } = require('../models');
const auth = require('../middleware/requireBatimatScanner');
const registrationController = require('../controllers/batimatAfterController');
const { createScannerService, publicRegistration, validateRegistration, validId } = require('../services/batimatScannerService');
const service = createScannerService({ model, sequelize });
const router = express.Router();
router.use(auth);
const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (error) { next(error); } };

router.get('/session', (req, res) => res.json({ agent: req.scannerAgent, event: 'After Batimat · Paris', timeZone: 'Europe/Paris' }));
router.get('/stats', wrap(async (req, res) => {
  const [row] = await sequelize.query(`SELECT COUNT(*) AS registered,
    COALESCE(SUM(checked_in_at IS NOT NULL), 0) AS visited,
    COALESCE(SUM(checked_in_at IS NOT NULL AND checked_out_at IS NULL), 0) AS inside,
    COALESCE(SUM(checked_out_at IS NOT NULL), 0) AS departed
    FROM batimat_after_registrations`, { type: QueryTypes.SELECT });
  res.json({ ...Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)])), serverTime: new Date().toISOString() });
}));
router.post('/lookup', wrap(async (req, res) => res.json({ registration: await service.lookup(req.body?.payload) })));
router.get('/registrations', wrap(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  // Rejeter les jokers pour que la recherche reste une recherche littérale simple.
  if (/[\\%_]/.test(q)) return res.status(400).json({ message: 'Retire les caractères %, _ et \\ de la recherche.' });
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const limit = 30;
  const words = q.split(/\s+/).filter(Boolean);
  const where = words.length ? { [Op.and]: words.map(word => ({ [Op.or]:
    ['firstName', 'lastName', 'email', 'phone'].map(key => ({ [key]: { [Op.like]: `%${word}%` } }))
  })) } : {};
  const { rows, count } = await model.findAndCountAll({ where,
    attributes: { exclude: ['qrToken', 'ipAddress'] },
    order: [['created_at', 'DESC'], ['id', 'DESC']], limit, offset: (page - 1) * limit });
  res.json({ items: rows.map(publicRegistration), total: count, page, hasMore: page * limit < count });
}));
router.get('/registrations/:id', wrap(async (req, res) => res.json({ registration: await service.get(req.params.id) })));
router.post('/registrations/:id/point', wrap(async (req, res) => {
  const registration = await service.point(req.params.id, req.body?.action, req.body?.expected);
  console.info(JSON.stringify({ type: 'batimat_pointage', agent: req.scannerAgent,
    registrationId: registration.id, action: req.body.action, at: new Date().toISOString() }));
  res.json({ registration, message: req.body.action === 'in' ? 'Entrée enregistrée.' : 'Sortie enregistrée.' });
}));
router.post('/registrations', wrap(async (req, res) => {
  // Réutilise la création existante : même table, normalisation téléphone, e-mail, badge et CRM.
  req.body = validateRegistration(req.body);
  await registrationController.createRegistration(req, res);
}));
router.post('/registrations/:id/resend-badge', wrap(async (req, res) => {
  validId(req.params.id);
  await registrationController.resendBadge(req, res);
}));
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.status) return res.status(error.status).json({ code: error.code, message: error.message });
  // Ne pas exposer de requêtes SQL, de jetons ou de données personnelles au client.
  console.error('[batimat-scanner]', error.name || 'Error');
  res.status(500).json({ code: 'SERVER_ERROR', message: 'Serveur indisponible. Vérifie l’état du visiteur avant de réessayer.' });
});
module.exports = router;
