'use strict';
const models = require('../models');
const { generatePassword, hashPassword } = require('../services/jpoAgentAuth');
const { createJpoNiceScannerService, leadView, AVAILABILITIES } = require('../services/jpoNiceScannerService');

// Administration (dashboard web, protégé par le token dashboard) des prospects et comptes de la JPO Nice.
const { JpoNiceAgent: Agent, JpoNiceLead: Lead, JpoNiceScan: Scan, JpoNiceRegistration: Registration, JpoNiceCheckin: Checkin, JpoNicePassage: Passage } = models;
const service = createJpoNiceScannerService({ Agent, Lead, Scan, Registration, Checkin, Passage, sequelize: models.sequelize });

const ROLES = ['commercial', 'manager', 'accueil'];
const agentView = (a) => ({
  id: a.id,
  name: a.name,
  email: a.email,
  role: a.role,
  active: a.active,
  availability: a.availability,
  availabilityLabel: AVAILABILITIES[a.availability] || a.availability,
  lastLoginAt: a.lastLoginAt ? new Date(a.lastLoginAt).toISOString() : null,
});

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ code: error.code, message: error.message });
    console.error('❌ [jpo-nice-admin]', error.original?.sqlMessage || error.message);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};

// Tout ce dont le dashboard a besoin en un appel : comptes, prospects (avec la fiche du visiteur), journal des
// scans, passages et arrivées.
exports.overview = handle(async (req, res) => {
  const [agents, leads, scans, checkins, passages] = await Promise.all([
    Agent.findAll({ order: [['name', 'ASC']] }),
    Lead.findAll({ order: [['first_scanned_at', 'DESC']] }),
    Scan.findAll({ order: [['created_at', 'DESC']], limit: 20000 }),
    Checkin.findAll({ order: [['checked_in_at', 'DESC']], limit: 20000 }),
    Passage.findAll({ order: [['id', 'ASC']], limit: 50000 }),
  ]);
  const regs = leads.length ? await Registration.findAll({ where: { id: leads.map((l) => l.registrationId) } }) : [];
  const regById = new Map(regs.map((r) => [r.id, r]));
  const nameById = new Map(agents.map((a) => [a.id, a.name]));
  const checkinIds = new Set(checkins.map((c) => c.registrationId));
  res.json({
    agents: agents.map(agentView),
    leads: leads.map((l) => leadView(l, regById.get(l.registrationId), nameById.get(l.agentId), nameById.get(l.assignedById))),
    scans: scans.map((s) => ({
      id: s.id,
      registrationId: s.registrationId,
      leadId: s.leadId,
      agentId: s.agentId,
      isDuplicate: s.isDuplicate,
      scannedAt: new Date(s.created_at).toISOString(),
    })),
    passages: passages.map((p) => ({ registrationId: p.registrationId, agentId: p.agentId, direction: p.direction, at: new Date(p.created_at).toISOString() })),
    // Arrivées : accueil + scan d'un commercial + (déduites) prospects sans ligne d'arrivée.
    checkins: [
      ...checkins.map((c) => ({ registrationId: c.registrationId, agentId: c.agentId, scanCount: c.scanCount, checkedInAt: new Date(c.checkedInAt).toISOString() })),
      ...leads
        .filter((l) => !checkinIds.has(l.registrationId))
        .map((l) => ({ registrationId: l.registrationId, agentId: l.agentId, scanCount: l.scanCount, checkedInAt: new Date(l.firstScannedAt).toISOString() })),
    ],
  });
});

exports.updateLead = handle(async (req, res) => res.json(await service.adminUpdateLead(req.params.id, req.body)));

exports.createAgent = handle(async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 150) : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 255) : '';
  const role = req.body?.role || 'commercial';
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !ROLES.includes(role)) {
    return res.status(400).json({ message: 'Nom, e-mail valide et rôle requis.' });
  }
  if (await Agent.findOne({ where: { email } })) return res.status(409).json({ message: 'Un compte existe déjà avec cet e-mail.' });
  const requested = typeof req.body?.password === 'string' ? req.body.password : '';
  if (requested && requested.length < 8) return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caractères.' });
  const password = requested || generatePassword();
  const agent = await Agent.create({ name, email, role, passwordHash: await hashPassword(password), active: true });
  // Le mot de passe n'est renvoyé qu'ici, une seule fois : il n'est stocké que sous forme de hash.
  return res.status(201).json({ agent: agentView(agent), password });
});

exports.updateAgent = handle(async (req, res) => {
  const agent = await Agent.findByPk(Number(req.params.id));
  if (!agent) return res.status(404).json({ message: 'Compte introuvable.' });
  const changes = {};
  if (typeof req.body?.active === 'boolean') changes.active = req.body.active;
  if (req.body?.role !== undefined) {
    if (!ROLES.includes(req.body.role)) return res.status(400).json({ message: 'Rôle invalide.' });
    changes.role = req.body.role;
  }
  if (req.body?.availability !== undefined) {
    if (!Object.hasOwn(AVAILABILITIES, req.body.availability)) return res.status(400).json({ message: 'Disponibilité invalide.' });
    changes.availability = req.body.availability;
  }
  if (typeof req.body?.name === 'string' && req.body.name.trim()) changes.name = req.body.name.trim().slice(0, 150);
  if (!Object.keys(changes).length) return res.status(400).json({ message: 'Aucune modification.' });
  await agent.update(changes);
  return res.json({ agent: agentView(agent) });
});

exports.resetPassword = handle(async (req, res) => {
  const agent = await Agent.findByPk(Number(req.params.id));
  if (!agent) return res.status(404).json({ message: 'Compte introuvable.' });
  const password = generatePassword();
  await agent.update({ passwordHash: await hashPassword(password) });
  return res.json({ agent: agentView(agent), password });
});
