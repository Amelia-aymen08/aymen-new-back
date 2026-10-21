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
  Checkin: models.JpoHeleniteCheckin,
  sequelize: models.sequelize,
});

const auth = makeAuth({
  findAgent: (email) => models.JpoHeleniteAgent.findOne({ where: { email } }),
  touchLogin: (agent) => agent.update({ lastLoginAt: new Date() }),
});

const router = express.Router();
router.use(auth);

// Accès par rôle : « commercial » scanne et qualifie des prospects ; « accueil » enregistre seulement les
// arrivées ; « manager » a les deux. Tous peuvent lire /session, /stats et chercher un visiteur.
const allow = (...roles) => (req, res, next) =>
  roles.includes(req.jpoAgent.role) ? next() : res.status(403).json({ code: 'FORBIDDEN', message: 'Cette action n’est pas disponible pour ce compte.' });
const forLeads = allow('commercial', 'manager');
const forReception = allow('accueil', 'manager');
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
router.post('/scan', forLeads, wrap(async (req, res) => {
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
router.get('/leads', forLeads, wrap(async (req, res) => res.json(await service.listLeads(req.jpoAgent, req.query))));
router.get('/leads/:id', forLeads, wrap(async (req, res) => res.json(await service.getLead(req.jpoAgent, req.params.id))));
router.patch('/leads/:id', forLeads, wrap(async (req, res) => res.json(await service.updateLead(req.jpoAgent, req.params.id, req.body))));
router.post('/checkin', forReception, wrap(async (req, res) => {
  const result = await service.checkIn(req.jpoAgent, { payload: req.body?.payload, registrationId: req.body?.registrationId });
  console.info(JSON.stringify({
    type: 'jpo_checkin', agent: req.jpoAgent.email, registrationId: result.visitor.id,
    firstTime: result.firstTime, at: new Date().toISOString(),
  }));
  res.json(result);
}));
router.get('/registrations', wrap(async (req, res) => res.json(await service.searchRegistrations(req.jpoAgent, req.query))));

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.status) return res.status(error.status).json({ code: error.code, message: error.message });
  // Ni requête SQL ni donnée personnelle dans la réponse.
  console.error('[jpo-scanner]', error.name || 'Error', error.original?.sqlMessage || error.message);
  return res.status(500).json({ code: 'SERVER_ERROR', message: 'Serveur indisponible. Vérifie l’état du prospect avant de réessayer.' });
});

module.exports = router;
