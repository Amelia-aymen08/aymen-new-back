'use strict';
const { Op } = require('sequelize');
const { parseLeadUpdate, endOfTodayAlgiers, validId, ScannerError, TEMPERATURES, STATUSES, CLOSED_STATUSES } = require('./jpoScannerService');

// Logique métier de l'application de scan JPO Nice (31 octobre & 1er novembre 2026).
//
// Différences avec la JPO Hélénite (dont le service n'est pas modifié) :
//  - 4 agents d'accueil enregistrent l'arrivée ET affectent le visiteur à l'un des 4 commerciaux, en voyant leur disponibilité ;
//  - un visiteur déjà affecté (ou checké) par un commercial ne peut pas être « re-checké » par un autre commercial :
//    il reçoit un message avec un clin d'œil lui indiquant chez qui le visiteur est déjà passé.

const AVAILABILITIES = { available: 'Disponible', busy: 'Occupé', break: 'En pause' };
const fail = (status, code, message) => {
  throw new ScannerError(status, code, message);
};
const iso = (value) => (value ? new Date(value).toISOString() : null);

// QR du badge : AYMEN-NICE26|<jeton>|<prénom>|<nom>. Seul le jeton retrouve l'inscription.
function parseBadge(value) {
  if (typeof value !== 'string' || value.length > 1024) fail(400, 'INVALID_QR', 'QR code invalide.');
  const parts = value.trim().split('|');
  if (parts.length !== 4 || parts[0] !== 'AYMEN-NICE26' || !/^[a-f0-9]{16,32}$/i.test(parts[1])) {
    fail(400, 'INVALID_QR', 'Ce QR code ne correspond pas à un badge JPO Nice.');
  }
  return parts[1].toLowerCase();
}

const DAY_LABELS = { samedi: 'Samedi 31/10', dimanche: 'Dimanche 01/11', flexible: 'Samedi ou dimanche' };
const TIME_LABELS = { matin: 'Matin', apres_midi: 'Après-midi', flexible: 'Horaire flexible', a_confirmer: 'Horaire à confirmer' };
const visitLabel = (reg) => `${DAY_LABELS[reg.visitDay] || reg.visitDay || '—'} · ${TIME_LABELS[reg.timePref] || reg.timePref || '—'}`;

function publicVisitor(reg) {
  if (!reg) return null;
  return {
    id: reg.id,
    firstName: reg.firstName,
    lastName: reg.lastName,
    email: reg.email,
    phone: reg.phone,
    // L'application affiche `visitLabel` quand il est présent (visiteurs de Nice : jour + demi-journée).
    visitDate: null,
    timeSlot: null,
    visitDay: reg.visitDay,
    visitLabel: visitLabel(reg),
    profile: reg.profile,
    objective: reg.objective,
    typology: reg.typology,
    horizon: reg.horizon,
    city: reg.city,
    country: reg.residenceCountry,
    message: reg.message,
    registrationStatus: reg.status,
  };
}

function leadView(lead, reg, agentName, assignedByName) {
  return {
    id: lead.id,
    registrationId: lead.registrationId,
    agentId: lead.agentId,
    agentName: agentName || null,
    assignedById: lead.assignedById || null,
    assignedByName: assignedByName || null,
    firstScannedAt: iso(lead.firstScannedAt),
    lastScannedAt: iso(lead.lastScannedAt),
    scanCount: lead.scanCount,
    temperature: lead.temperature,
    rating: lead.rating,
    status: lead.status,
    statusLabel: STATUSES[lead.status] || lead.status,
    note: lead.note,
    nextAction: lead.nextAction,
    followUpAt: iso(lead.followUpAt),
    treatedAt: iso(lead.treatedAt),
    visitor: publicVisitor(reg),
  };
}

function createJpoNiceScannerService({ Agent, Lead, Scan, Registration, Checkin, Passage, sequelize, now = () => new Date() }) {
  const isManager = (agent) => agent.role === 'manager';
  const canEdit = (agent, lead) => isManager(agent) || lead.agentId === agent.id;

  async function findRegistration({ payload, registrationId }) {
    let registration = null;
    if (payload !== undefined) registration = await Registration.findOne({ where: { qrToken: parseBadge(payload) } });
    else registration = await Registration.findByPk(validId(registrationId));
    if (!registration) fail(404, 'NOT_FOUND', 'Badge introuvable dans les inscriptions.');
    return registration;
  }

  async function agentNames(ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map();
    const rows = await Agent.findAll({ where: { id: { [Op.in]: unique } }, attributes: ['id', 'name'] });
    return new Map(rows.map((r) => [r.id, r.name]));
  }
  async function registrationsById(ids) {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map();
    const rows = await Registration.findAll({ where: { id: { [Op.in]: unique } } });
    return new Map(rows.map((r) => [r.id, r]));
  }

  // Arrivée : 1re arrivée conservée (jamais écrasée). Renvoie { row, firstTime }.
  async function recordArrival(agent, regId) {
    let row = await Checkin.findOne({ where: { registrationId: regId } });
    if (row) return { row, firstTime: false };
    try {
      row = await Checkin.create({ registrationId: regId, agentId: agent.id, checkedInAt: now(), scanCount: 1 });
      return { row, firstTime: true };
    } catch (error) {
      if (error.name !== 'SequelizeUniqueConstraintError') throw error;
      return { row: await Checkin.findOne({ where: { registrationId: regId } }), firstTime: false };
    }
  }
  async function lastPassage(regId) {
    const rows = await Passage.findAll({ where: { registrationId: regId }, order: [['id', 'ASC']] });
    return rows.length ? rows[rows.length - 1] : null;
  }
  async function arrivalFor(regId) {
    const row = await Checkin.findOne({ where: { registrationId: regId } });
    if (row) return row;
    const lead = await Lead.findOne({ where: { registrationId: regId } });
    return lead ? { registrationId: regId, agentId: lead.agentId, checkedInAt: lead.firstScannedAt, scanCount: lead.scanCount, viaLead: true } : null;
  }

  // Charge de chaque commercial actif : affectés, en attente de traitement, traités. Triés : disponibles d'abord,
  // puis le moins chargé — l'accueil voit tout de suite à qui envoyer le prochain visiteur.
  async function commercialsBoard() {
    const [agents, leads] = await Promise.all([
      Agent.findAll({ where: { role: 'commercial', active: true }, order: [['name', 'ASC']] }),
      Lead.findAll({ attributes: ['id', 'agentId', 'treatedAt'] }),
    ]);
    const byAgent = new Map();
    leads.forEach((l) => {
      const c = byAgent.get(l.agentId) || { assigned: 0, waiting: 0 };
      c.assigned += 1;
      if (!l.treatedAt) c.waiting += 1;
      byAgent.set(l.agentId, c);
    });
    const rank = { available: 0, busy: 1, break: 2 };
    return agents
      .map((a) => {
        const c = byAgent.get(a.id) || { assigned: 0, waiting: 0 };
        return {
          id: a.id, name: a.name, availability: a.availability, availabilityLabel: AVAILABILITIES[a.availability] || a.availability,
          assigned: c.assigned, waiting: c.waiting, treated: c.assigned - c.waiting,
        };
      })
      .sort((a, b) => (rank[a.availability] ?? 3) - (rank[b.availability] ?? 3) || a.waiting - b.waiting || a.name.localeCompare(b.name));
  }

  const ownerInfo = async (lead) => {
    const names = await agentNames([lead.agentId, lead.assignedById]);
    return { ownerName: names.get(lead.agentId) || null, assignedByName: names.get(lead.assignedById) || null };
  };

  return {
    commercialsBoard,

    // Un commercial change sa disponibilité (visible de l'accueil).
    async setAvailability(agent, value) {
      if (!Object.hasOwn(AVAILABILITIES, value)) fail(400, 'INVALID_FIELD', 'Disponibilité invalide.');
      const row = await Agent.findByPk(agent.id);
      if (!row) fail(404, 'NOT_FOUND', 'Compte introuvable.');
      await row.update({ availability: value });
      return { availability: value, availabilityLabel: AVAILABILITIES[value] };
    },
    async myAvailability(agent) {
      const row = await Agent.findByPk(agent.id);
      const value = row?.availability || 'available';
      return { availability: value, availabilityLabel: AVAILABILITIES[value] };
    },

    // Scan d'un badge par un COMMERCIAL (ou sélection manuelle). Premier à checker = propriétaire.
    // Si un autre commercial a déjà le visiteur : `blocked` (message avec clin d'œil), rien n'est modifié sur le prospect.
    async scan(agent, { payload, registrationId }) {
      const registration = await findRegistration({ payload, registrationId });
      const regId = registration.id;

      const result = await sequelize.transaction(async (transaction) => {
        const at = now();
        let created = false;
        let lead = await Lead.findOne({ where: { registrationId: regId }, transaction });
        if (!lead) {
          try {
            lead = await Lead.create(
              { registrationId: regId, agentId: agent.id, assignedById: null, firstScannedAt: at, lastScannedAt: at, scanCount: 1, status: 'a_contacter' },
              { transaction },
            );
            created = true;
          } catch (error) {
            // Deux commerciaux scannent la même personne en même temps : l'unicité tranche, le second est bloqué.
            if (error.name !== 'SequelizeUniqueConstraintError') throw error;
            lead = await Lead.findOne({ where: { registrationId: regId }, transaction });
          }
        }
        const mine = lead.agentId === agent.id;
        if (!created && (mine || isManager(agent))) {
          await lead.increment('scanCount', { transaction });
          await lead.update({ lastScannedAt: at }, { transaction });
          await lead.reload({ transaction });
        }
        await Scan.create({ registrationId: regId, leadId: lead.id, agentId: agent.id, isDuplicate: !created }, { transaction });
        return { lead, created };
      });

      const { lead, created } = result;
      const owner = await ownerInfo(lead);
      if (!created && lead.agentId !== agent.id && !isManager(agent)) {
        return {
          blocked: {
            kind: 'already_checked',
            ownerName: owner.ownerName,
            assignedByName: owner.assignedByName,
            firstScannedAt: iso(lead.firstScannedAt),
            treated: Boolean(lead.treatedAt),
            visitor: { id: registration.id, firstName: registration.firstName, lastName: registration.lastName },
            message: `Clin d’œil 😉 Ce visiteur a déjà été checké : il est déjà passé chez ${owner.ownerName || 'un autre commercial'}.`,
          },
        };
      }
      // Un visiteur scanné par un commercial est forcément arrivé : l'arrivée est enregistrée si l'accueil ne l'a pas fait.
      try {
        await recordArrival(agent, regId);
      } catch (error) {
        console.warn('[jpo-nice-scanner] arrivée non enregistrée:', error.original?.sqlMessage || error.message);
      }
      const view = leadView(lead, registration, owner.ownerName, owner.assignedByName);
      return {
        lead: view,
        mine: lead.agentId === agent.id,
        editable: canEdit(agent, lead),
        duplicate: created ? null : { kind: lead.agentId === agent.id ? 'self' : 'other', ownerName: owner.ownerName, firstScannedAt: iso(lead.firstScannedAt), previousScanCount: lead.scanCount - 1 },
        assignedByReception: Boolean(lead.assignedById),
      };
    },

    // ACCUEIL — ENTRÉE. Sans `agentId` : renvoie `choose_agent` (visiteur + commerciaux avec disponibilité), rien n'est écrit.
    // Avec `agentId` : arrivée + affectation du visiteur à ce commercial. Visiteur déjà affecté : on le dit, on ne change rien.
    async checkIn(agent, { payload, registrationId, agentId }) {
      const registration = await findRegistration({ payload, registrationId });
      const regId = registration.id;
      let lead = await Lead.findOne({ where: { registrationId: regId } });
      const visitor = publicVisitor(registration);

      if (lead) {
        const arrival = await recordArrival(agent, regId);
        const last = await lastPassage(regId);
        const wasOut = Boolean(last) && last.direction === 'out';
        if (wasOut || !last) await Passage.create({ registrationId: regId, agentId: agent.id, direction: 'in' });
        const owner = await ownerInfo(lead);
        return {
          visitor,
          outcome: wasOut ? 'returned' : 'already_inside',
          assigned: { agentId: lead.agentId, name: owner.ownerName, at: iso(lead.firstScannedAt), treated: Boolean(lead.treatedAt), byName: owner.assignedByName },
          checkedInAt: iso(arrival.row.checkedInAt),
          message: `Clin d’œil 😉 Ce visiteur a déjà été checké : il est déjà passé chez ${owner.ownerName || 'un commercial'}.`,
        };
      }

      if (agentId === undefined || agentId === null || agentId === '') {
        return { visitor, outcome: 'choose_agent', commercials: await commercialsBoard() };
      }
      const target = await Agent.findByPk(validId(agentId));
      if (!target || target.role !== 'commercial' || !target.active) fail(404, 'AGENT_NOT_FOUND', 'Commercial introuvable ou inactif.');

      const at = now();
      let created = true;
      try {
        lead = await Lead.create({ registrationId: regId, agentId: target.id, assignedById: agent.id, firstScannedAt: at, lastScannedAt: at, scanCount: 1, status: 'a_contacter' });
      } catch (error) {
        // Un autre agent d'accueil (ou un commercial) vient d'affecter ce visiteur : on rend sa réponse, on n'écrase rien.
        if (error.name !== 'SequelizeUniqueConstraintError') throw error;
        lead = await Lead.findOne({ where: { registrationId: regId } });
        created = false;
      }
      if (!created) {
        const owner = await ownerInfo(lead);
        return {
          visitor,
          outcome: 'already_inside',
          assigned: { agentId: lead.agentId, name: owner.ownerName, at: iso(lead.firstScannedAt), treated: Boolean(lead.treatedAt), byName: owner.assignedByName },
          message: `Clin d’œil 😉 Ce visiteur vient d’être checké : il est déjà passé chez ${owner.ownerName || 'un commercial'}.`,
        };
      }
      const arrival = await recordArrival(agent, regId);
      await Passage.create({ registrationId: regId, agentId: agent.id, direction: 'in' });
      return {
        visitor,
        outcome: 'arrived',
        assigned: { agentId: target.id, name: target.name, at: iso(at), treated: false, byName: agent.name },
        checkedInAt: iso(arrival.row.checkedInAt),
      };
    },

    // ACCUEIL — SORTIE (même logique indulgente qu'à Hélénite : un visiteur jamais vu est accepté et signalé).
    async checkOut(agent, { payload, registrationId }) {
      const registration = await findRegistration({ payload, registrationId });
      const regId = registration.id;
      let arrival = await arrivalFor(regId);
      let noArrival = false;
      if (!arrival) {
        arrival = (await recordArrival(agent, regId)).row;
        noArrival = true;
      }
      const visitor = publicVisitor(registration);
      const last = await lastPassage(regId);
      if (last && last.direction === 'out') {
        const names = await agentNames([last.agentId]);
        return { visitor, outcome: 'already_left', leftAt: iso(last.created_at), leftBy: names.get(last.agentId) || null, checkedInAt: iso(arrival.checkedInAt) };
      }
      const passage = await Passage.create({ registrationId: regId, agentId: agent.id, direction: 'out' });
      return { visitor, outcome: 'left', leftAt: iso(passage.created_at), leftBy: agent.name, checkedInAt: iso(arrival.checkedInAt), noArrival };
    },

    async getLead(agent, id) {
      const lead = await Lead.findByPk(validId(id));
      if (!lead) fail(404, 'NOT_FOUND', 'Prospect introuvable.');
      const [regs, owner] = await Promise.all([registrationsById([lead.registrationId]), ownerInfo(lead)]);
      return {
        lead: leadView(lead, regs.get(lead.registrationId), owner.ownerName, owner.assignedByName),
        mine: lead.agentId === agent.id,
        editable: canEdit(agent, lead),
      };
    },

    async updateLead(agent, id, body) {
      const lead = await Lead.findByPk(validId(id));
      if (!lead) fail(404, 'NOT_FOUND', 'Prospect introuvable.');
      if (!canEdit(agent, lead)) fail(403, 'NOT_OWNER', 'Ce prospect est rattaché à un autre commercial.');
      const changes = parseLeadUpdate(body);
      if (!Object.keys(changes).length) fail(400, 'NOTHING_TO_UPDATE', 'Aucune modification à enregistrer.');
      if (!lead.treatedAt) changes.treatedAt = now();
      await lead.update(changes);
      return this.getLead(agent, id);
    },

    // Prospects : les siens (défaut) ou, pour un manager, ceux de tous (scope=all).
    async listLeads(agent, query = {}) {
      const where = {};
      if (!(isManager(agent) && query.scope === 'all')) where.agentId = agent.id;
      if (query.temperature) {
        if (query.temperature === 'none') where.temperature = null;
        else if (TEMPERATURES.includes(query.temperature)) where.temperature = query.temperature;
      }
      if (query.status && Object.hasOwn(STATUSES, query.status)) where.status = query.status;
      if (query.filter === 'untreated') where.treatedAt = null;
      if (query.filter === 'appointments') where.status = { [Op.in]: ['rdv_a_confirmer', 'rdv_confirme'] };
      if (query.filter === 'due') {
        where.followUpAt = { [Op.lte]: endOfTodayAlgiers(now()) };
        where.status = { [Op.notIn]: CLOSED_STATUSES };
      }
      const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
      if (/[\\%_]/.test(q)) fail(400, 'INVALID_QUERY', 'Retire les caractères %, _ et \\ de la recherche.');
      if (q) {
        const words = q.split(/\s+/).filter(Boolean);
        const regs = await Registration.findAll({
          where: { [Op.and]: words.map((w) => ({ [Op.or]: ['firstName', 'lastName', 'email', 'phone'].map((k) => ({ [k]: { [Op.like]: `%${w}%` } })) })) },
          attributes: ['id'],
          limit: 500,
        });
        where.registrationId = { [Op.in]: regs.map((r) => r.id).concat([0]) };
      }
      const page = Math.max(1, Math.min(10000, Number.parseInt(query.page, 10) || 1));
      const limit = 30;
      // Les prospects à traiter d'abord (arrivés les plus tôt en tête), puis les plus récemment modifiés.
      const order = query.filter === 'due' ? [['follow_up_at', 'ASC'], ['id', 'ASC']] : [['updated_at', 'DESC'], ['id', 'DESC']];
      const { rows, count } = await Lead.findAndCountAll({ where, order, limit, offset: (page - 1) * limit });
      const [regs, names] = await Promise.all([
        registrationsById(rows.map((r) => r.registrationId)),
        agentNames(rows.flatMap((r) => [r.agentId, r.assignedById])),
      ]);
      return {
        items: rows.map((l) => leadView(l, regs.get(l.registrationId), names.get(l.agentId), names.get(l.assignedById))),
        total: count,
        page,
        hasMore: page * limit < count,
      };
    },

    // Compteurs : accueil (arrivées + charge des commerciaux), commercial (ses prospects), manager (tous).
    async stats(agent) {
      if (agent.role === 'accueil') {
        const arrivalAt = new Map();
        (await Checkin.findAll({ attributes: ['id', 'registrationId', 'checkedInAt'] })).forEach((r) => arrivalAt.set(r.registrationId, r.checkedInAt));
        (await Lead.findAll({ attributes: ['id', 'registrationId', 'firstScannedAt'] })).forEach((l) => {
          if (!arrivalAt.has(l.registrationId)) arrivalAt.set(l.registrationId, l.firstScannedAt);
        });
        const dayOf = (d) => new Date(new Date(d).getTime() + 3600000).toISOString().slice(0, 10);
        const today = dayOf(now());
        let arrivedToday = 0;
        for (const at of arrivalAt.values()) if (dayOf(at) === today) arrivedToday += 1;
        const lastByReg = new Map();
        (await Passage.findAll({ order: [['id', 'ASC']] })).forEach((p) => lastByReg.set(p.registrationId, p));
        let departed = 0;
        for (const id of arrivalAt.keys()) if (lastByReg.get(id)?.direction === 'out') departed += 1;
        return {
          arrived: arrivalAt.size, arrivedToday, departed, inside: arrivalAt.size - departed,
          registered: await Registration.count(), scope: 'reception', commercials: await commercialsBoard(), serverTime: now().toISOString(),
        };
      }
      const where = isManager(agent) ? {} : { agentId: agent.id };
      const leads = await Lead.findAll({ where, attributes: ['id', 'temperature', 'status', 'followUpAt', 'treatedAt'] });
      const end = endOfTodayAlgiers(now());
      const s = { scanned: leads.length, hot: 0, warm: 0, cold: 0, untreated: 0, due: 0, appointments: 0 };
      for (const l of leads) {
        if (l.temperature && s[l.temperature] !== undefined) s[l.temperature] += 1;
        if (!l.treatedAt) s.untreated += 1;
        if (l.followUpAt && new Date(l.followUpAt) <= end && !CLOSED_STATUSES.includes(l.status)) s.due += 1;
        if (l.status === 'rdv_a_confirmer' || l.status === 'rdv_confirme') s.appointments += 1;
      }
      const me = await this.myAvailability(agent);
      return { ...s, ...me, registered: await Registration.count(), scope: isManager(agent) ? 'all' : 'mine', serverTime: now().toISOString() };
    },

    // Recherche manuelle d'un visiteur inscrit (badge illisible / oublié).
    async searchRegistrations(agent, query = {}) {
      const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
      if (/[\\%_]/.test(q)) fail(400, 'INVALID_QUERY', 'Retire les caractères %, _ et \\ de la recherche.');
      const page = Math.max(1, Math.min(10000, Number.parseInt(query.page, 10) || 1));
      const limit = 30;
      const words = q.split(/\s+/).filter(Boolean);
      const where = words.length
        ? { [Op.and]: words.map((w) => ({ [Op.or]: ['firstName', 'lastName', 'email', 'phone'].map((k) => ({ [k]: { [Op.like]: `%${w}%` } })) })) }
        : {};
      const { rows, count } = await Registration.findAndCountAll({ where, order: [['created_at', 'DESC'], ['id', 'DESC']], limit, offset: (page - 1) * limit });
      const ids = rows.map((r) => r.id);
      const leads = ids.length ? await Lead.findAll({ where: { registrationId: { [Op.in]: ids } } }) : [];
      const names = await agentNames(leads.map((l) => l.agentId));
      const byReg = new Map(leads.map((l) => [l.registrationId, l]));
      const arrivals = new Map((ids.length ? await Checkin.findAll({ where: { registrationId: { [Op.in]: ids } } }) : []).map((c) => [c.registrationId, c]));
      const passages = ids.length ? await Passage.findAll({ where: { registrationId: { [Op.in]: ids } }, order: [['id', 'ASC']] }) : [];
      const lastById = new Map();
      passages.forEach((p) => lastById.set(p.registrationId, p));
      return {
        items: rows.map((r) => {
          const l = byReg.get(r.id);
          const arrival = arrivals.get(r.id) || (l && { checkedInAt: l.firstScannedAt });
          const last = lastById.get(r.id);
          const presence = !arrival ? 'registered' : last && last.direction === 'out' ? 'left' : 'inside';
          return { ...publicVisitor(r), leadId: l ? l.id : null, ownerName: l ? names.get(l.agentId) || null : null, mine: l ? l.agentId === agent.id : false, arrivedAt: arrival ? iso(arrival.checkedInAt) : null, presence };
        }),
        total: count,
        page,
        hasMore: page * limit < count,
      };
    },

    // --- Administration (dashboard web) ---
    async adminUpdateLead(id, body) {
      const lead = await Lead.findByPk(validId(id));
      if (!lead) fail(404, 'NOT_FOUND', 'Prospect introuvable.');
      const changes = parseLeadUpdate(body);
      if (body && 'agentId' in body) {
        const target = await Agent.findByPk(validId(body.agentId));
        if (!target) fail(404, 'AGENT_NOT_FOUND', 'Commercial introuvable.');
        if (target.role === 'accueil') fail(400, 'INVALID_AGENT', 'Un compte accueil ne peut pas avoir de prospects.');
        changes.agentId = target.id;
      }
      if (!Object.keys(changes).length) fail(400, 'NOTHING_TO_UPDATE', 'Aucune modification à enregistrer.');
      await lead.update(changes);
      return { id: lead.id };
    },
  };
}

module.exports = { createJpoNiceScannerService, parseBadge, publicVisitor, leadView, visitLabel, AVAILABILITIES };
