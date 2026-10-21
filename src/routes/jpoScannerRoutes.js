'use strict';
const express = require('express');
const models = require('../models');
const { makeAuth } = require('../middleware/requireJpoAgent');
const { createJpoScannerService, STATUSES, TEMPERATURES } = require('../services/jpoScannerService');

// API de l'application mobile de scan JPO Hélénite : /api/jpo-scanner
const service = createJpoScannerService({
  Agent: models.JpoHeleniteAgent,
  Lead: models.JpoHeleniteLead,
  Scan: models.JpoHeleniteScan,
  Registration: models.JpoHeleniteRegistration,
  sequelize: models.sequelize,
});

const auth = makeAuth({
  findAgent: (email) => models.JpoHeleniteAgent.findOne({ where: { email } }),
  touchLogin: (agent) => agent.update({ lastLoginAt: new Date() }),
});

const router = express.Router();
router.use(auth);
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

router.get('/session', (req, res) =>
  res.json({
    agent: req.jpoAgent.name,
    email: req.jpoAgent.email,
    role: req.jpoAgent.role,
    event: 'JPO Hélénite',
    timeZone: 'Africa/Algiers',
    statuses: STATUSES,
    temperatures: TEMPERATURES,
  }));
router.get('/stats', wrap(async (req, res) => res.json(await service.stats(req.jpoAgent))));
router.post('/scan', wrap(async (req, res) => {
  const result = await service.scan(req.jpoAgent, { payload: req.body?.payload, registrationId: req.body?.registrationId });
  console.info(JSON.stringify({
    type: 'jpo_scan',
    agent: req.jpoAgent.email,
    registrationId: result.lead.registrationId,
    duplicate: result.duplicate ? result.duplicate.kind : null,
    at: new Date().toISOString(),
  }));
  res.json(result);
}));
router.get('/leads', wrap(async (req, res) => res.json(await service.listLeads(req.jpoAgent, req.query))));
router.get('/leads/:id', wrap(async (req, res) => res.json(await service.getLead(req.jpoAgent, req.params.id))));
router.patch('/leads/:id', wrap(async (req, res) => res.json(await service.updateLead(req.jpoAgent, req.params.id, req.body))));
router.get('/registrations', wrap(async (req, res) => res.json(await service.searchRegistrations(req.jpoAgent, req.query))));

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.status) return res.status(error.status).json({ code: error.code, message: error.message });
  // Ni requête SQL ni donnée personnelle dans la réponse.
  console.error('[jpo-scanner]', error.name || 'Error', error.original?.sqlMessage || error.message);
  return res.status(500).json({ code: 'SERVER_ERROR', message: 'Serveur indisponible. Vérifie l’état du prospect avant de réessayer.' });
});

module.exports = router;
