'use strict';
const express = require('express');
const models = require('../models');
const { makeAuth } = require('../middleware/requireJpoAgent');
const { STATUSES, TEMPERATURES } = require('../services/jpoScannerService');
const { createJpoNiceScannerService, AVAILABILITIES } = require('../services/jpoNiceScannerService');

// API de l'application mobile / web de scan JPO Nice : /api/jpo-nice-scanner
// (indépendante de /api/jpo-scanner, utilisée en parallèle pour la JPO Hélénite).
const service = createJpoNiceScannerService({
  Agent: models.JpoNiceAgent,
  Lead: models.JpoNiceLead,
  Scan: models.JpoNiceScan,
  Registration: models.JpoNiceRegistration,
  Checkin: models.JpoNiceCheckin,
  Passage: models.JpoNicePassage,
  sequelize: models.sequelize,
});

const auth = makeAuth({
  findAgent: (email) => models.JpoNiceAgent.findOne({ where: { email } }),
  touchLogin: (agent) => agent.update({ lastLoginAt: new Date() }),
});

const router = express.Router();
router.use(auth);

// « commercial » scanne et qualifie ses prospects ; « accueil » enregistre entrées/sorties et affecte un commercial ;
// « manager » a les deux.
const allow = (...roles) => (req, res, next) =>
  roles.includes(req.jpoAgent.role) ? next() : res.status(403).json({ code: 'FORBIDDEN', message: 'Cette action n’est pas disponible pour ce compte.' });
const forLeads = allow('commercial', 'manager');
const forReception = allow('accueil', 'manager');
const forCommercial = allow('commercial');
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

router.get('/session', wrap(async (req, res) =>
  res.json({
    agent: req.jpoAgent.name,
    email: req.jpoAgent.email,
    role: req.jpoAgent.role,
    event: 'JPO Nice',
    eventDates: '31 octobre & 1er novembre 2026',
    timeZone: 'Europe/Paris',
    statuses: STATUSES,
    temperatures: TEMPERATURES,
    availabilities: AVAILABILITIES,
    ...(req.jpoAgent.role === 'commercial' ? await service.myAvailability(req.jpoAgent) : {}),
  })));
router.get('/stats', wrap(async (req, res) => res.json(await service.stats(req.jpoAgent))));

// Disponibilité des commerciaux (accueil, manager) et changement de sa propre disponibilité (commercial).
router.get('/commercials', wrap(async (req, res) => res.json({ commercials: await service.commercialsBoard() })));
router.patch('/availability', forCommercial, wrap(async (req, res) => res.json(await service.setAvailability(req.jpoAgent, req.body?.availability))));

router.post('/scan', forLeads, wrap(async (req, res) => {
  const result = await service.scan(req.jpoAgent, { payload: req.body?.payload, registrationId: req.body?.registrationId });
  console.info(JSON.stringify({
    type: 'jpo_nice_scan', agent: req.jpoAgent.email,
    registrationId: result.lead ? result.lead.registrationId : result.blocked.visitor.id,
    blocked: Boolean(result.blocked), duplicate: result.duplicate ? result.duplicate.kind : null, at: new Date().toISOString(),
  }));
  res.json(result);
}));
router.get('/leads', forLeads, wrap(async (req, res) => res.json(await service.listLeads(req.jpoAgent, req.query))));
router.get('/leads/:id', forLeads, wrap(async (req, res) => res.json(await service.getLead(req.jpoAgent, req.params.id))));
router.patch('/leads/:id', forLeads, wrap(async (req, res) => res.json(await service.updateLead(req.jpoAgent, req.params.id, req.body))));

router.post('/checkin', forReception, wrap(async (req, res) => {
  const result = await service.checkIn(req.jpoAgent, { payload: req.body?.payload, registrationId: req.body?.registrationId, agentId: req.body?.agentId });
  console.info(JSON.stringify({
    type: 'jpo_nice_checkin', agent: req.jpoAgent.email, registrationId: result.visitor.id,
    outcome: result.outcome, assignedTo: result.assigned ? result.assigned.agentId : null, at: new Date().toISOString(),
  }));
  res.json(result);
}));
router.post('/checkout', forReception, wrap(async (req, res) => {
  const result = await service.checkOut(req.jpoAgent, { payload: req.body?.payload, registrationId: req.body?.registrationId });
  console.info(JSON.stringify({
    type: 'jpo_nice_checkout', agent: req.jpoAgent.email, registrationId: result.visitor.id, outcome: result.outcome, at: new Date().toISOString(),
  }));
  res.json(result);
}));
router.get('/registrations', wrap(async (req, res) => res.json(await service.searchRegistrations(req.jpoAgent, req.query))));

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.status) return res.status(error.status).json({ code: error.code, message: error.message });
  // Ni requête SQL ni donnée personnelle dans la réponse.
  console.error('[jpo-nice-scanner]', error.name || 'Error', error.original?.sqlMessage || error.message);
  return res.status(500).json({ code: 'SERVER_ERROR', message: 'Serveur indisponible. Vérifie l’état du prospect avant de réessayer.' });
});

module.exports = router;
