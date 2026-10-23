'use strict';
const { Op } = require('sequelize');

// Logique métier de l'application de scan JPO Hélénite : un commercial scanne le badge d'un visiteur,
// le prospect lui est rattaché (date/heure du scan conservées), puis il le qualifie.

const TEMPERATURES = ['hot', 'warm', 'cold'];
const STATUSES = {
  a_contacter: 'À contacter',
  contacte: 'Contacté',
  rdv_a_confirmer: 'Rendez-vous à confirmer',
  rdv_confirme: 'Rendez-vous confirmé',
  a_relancer: 'À relancer',
  qualifie: 'Qualifié',
  sans_suite: 'Sans suite',
};
// Statuts « clos » : plus de relance à faire.
const CLOSED_STATUSES = ['qualifie', 'sans_suite'];

class ScannerError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, code, message) => {
  throw new ScannerError(status, code, message);
};
const iso = (value) => (value ? new Date(value).toISOString() : null);

// QR du badge : AYMEN-JPO26|<id inscription>|<prénom>|<nom>. Seul l'identifiant sert à retrouver
// l'inscription ; le nom écrit dans le QR n'est jamais utilisé comme preuve d'identité.
function parseBadge(value) {
  if (typeof value !== 'string' || value.length > 1024) fail(400, 'INVALID_QR', 'QR code invalide.');
  const parts = value.trim().split('|');
  if (parts.length !== 4 || parts[0] !== 'AYMEN-JPO26' || !/^[1-9]\d{0,9}$/.test(parts[1])) {
    fail(400, 'INVALID_QR', 'Ce QR code ne correspond pas à un badge JPO Hélénite.');
  }
  return Number(parts[1]);
}

function validId(value) {
  if (!/^[1-9]\d{0,9}$/.test(String(value))) fail(400, 'INVALID_ID', 'Identifiant invalide.');
  return Number(value);
}

function publicVisitor(reg) {
  if (!reg) return null;
  return {
    id: reg.id,
    firstName: reg.firstName,
    lastName: reg.lastName,
    email: reg.email,
    phone: reg.phone,
    visitDate: reg.visitDate,
    timeSlot: reg.timeSlot,
    profile: reg.profile,
    typology: reg.typology,
    horizon: reg.horizon,
    message: reg.message,
    registrationStatus: reg.status,
  };
}

function leadView(lead, reg, agentName) {
  return {
    id: lead.id,
    registrationId: lead.registrationId,
    agentId: lead.agentId,
    agentName: agentName || null,
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

// Valide et normalise les champs de qualification envoyés par l'application. Seuls les champs présents
// dans `body` sont retournés.
function parseLeadUpdate(body) {
  const b = body && typeof body === 'object' ? body : {};
  const out = {};
  if ('temperature' in b) {
    if (b.temperature !== null && !TEMPERATURES.includes(b.temperature)) fail(400, 'INVALID_FIELD', 'Niveau d’intérêt invalide.');
    out.temperature = b.temperature;
  }
  if ('rating' in b) {
    const r = b.rating;
    if (r !== null && !(Number.isInteger(r) && r >= 1 && r <= 5)) fail(400, 'INVALID_FIELD', 'La note doit être comprise entre 1 et 5.');
    out.rating = r;
  }
  if ('status' in b) {
    if (!Object.hasOwn(STATUSES, b.status)) fail(400, 'INVALID_FIELD', 'Statut commercial invalide.');
    out.status = b.status;
  }
  if ('note' in b) {
    if (b.note !== null && (typeof b.note !== 'string' || b.note.length > 4000)) fail(400, 'INVALID_FIELD', 'Note trop longue (4000 caractères maximum).');
    out.note = b.note && b.note.trim() ? b.note.trim() : null;
  }
  if ('nextAction' in b) {
    if (b.nextAction !== null && (typeof b.nextAction !== 'string' || b.nextAction.length > 255)) fail(400, 'INVALID_FIELD', 'Prochaine action trop longue (255 caractères maximum).');
    out.nextAction = b.nextAction && b.nextAction.trim() ? b.nextAction.trim() : null;
  }
  if ('followUpAt' in b) {
    if (b.followUpAt === null) out.followUpAt = null;
    else {
      const d = typeof b.followUpAt === 'string' ? new Date(b.followUpAt) : null;
      if (!d || Number.isNaN(d.getTime()) || d.getFullYear() < 2026 || d.getFullYear() > 2100) fail(400, 'INVALID_FIELD', 'Date de relance invalide.');
      out.followUpAt = d;
    }
  }
  return out;
}

// Fin de la journée d'aujourd'hui à Alger (UTC+1, sans changement d'heure) : sert à « relances du jour ».
function endOfTodayAlgiers(now) {
  const shifted = new Date(now.getTime() + 3600000);
  shifted.setUTCHours(23, 59, 59, 999);
  return new Date(shifted.getTime() - 3600000);
}

function createJpoScannerService({ Agent, Lead, Scan, Registration, Checkin = null, Passage = null, sequelize, now = () => new Date() }) {
  const isManager = (agent) => agent.role === 'manager';

  // Arrivée d'un visiteur : 1re arrivée conservée. `rescan` (accueil) incrémente le nombre de passages.
  // Renvoie { row, firstTime }. Sans table des arrivées (Checkin absent), ne fait rien.
  async function recordArrival(agent, regId, { rescan }) {
    if (!Checkin) return null;
    const at = now();
    let row = await Checkin.findOne({ where: { registrationId: regId } });
    if (row) {
      if (rescan) {
        await row.increment('scanCount');
        await row.reload();
      }
      return { row, firstTime: false };
    }
    try {
      row = await Checkin.create({ registrationId: regId, agentId: agent.id, checkedInAt: at, scanCount: 1 });
      return { row, firstTime: true };
    } catch (error) {
      if (error.name !== 'SequelizeUniqueConstraintError') throw error;
      row = await Checkin.findOne({ where: { registrationId: regId } });
      return { row, firstTime: false };
    }
  }

  // Dernier passage (entrée ou sortie) de chaque inscription : registrationId -> ligne.
  async function lastPassages(ids) {
    if (!Passage || !ids.length) return new Map();
    const rows = await Passage.findAll({ where: { registrationId: { [Op.in]: ids } }, order: [['id', 'ASC']] });
    const byReg = new Map();
    rows.forEach((r) => byReg.set(r.registrationId, r));
    return byReg;
  }
  // registered = pas encore arrivé · inside = présent · left = sorti (dernier passage « out »).
  const presenceState = (arrival, last) => (!arrival ? 'registered' : last && last.direction === 'out' ? 'left' : 'inside');

  // Arrivée de chaque inscription : ligne d'arrivée (accueil / 1er scan commercial) ou, à défaut, scan d'un
  // commercial (prospect) — les visiteurs scannés AVANT l'ajout de l'accueil n'ont pas de ligne d'arrivée mais
  // sont bel et bien présents. Ces arrivées « déduites » ({ viaLead: true }) ne sont jamais écrites en base.
  async function arrivalsByRegistration(ids) {
    const map = new Map();
    if (!ids.length) return map;
    if (Checkin) {
      const rows = await Checkin.findAll({ where: { registrationId: { [Op.in]: ids } } });
      rows.forEach((r) => map.set(r.registrationId, r));
    }
    const missing = ids.filter((id) => !map.has(id));
    if (missing.length) {
      const leads = await Lead.findAll({ where: { registrationId: { [Op.in]: missing } } });
      leads.forEach((l) => map.set(l.registrationId, {
        registrationId: l.registrationId, agentId: l.agentId, checkedInAt: l.firstScannedAt, scanCount: l.scanCount, viaLead: true,
      }));
    }
    return map;
  }

  async function agentNames(ids) {
    const unique = [...new Set(ids)];
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

  async function loadLead(agent, id) {
    const lead = await Lead.findByPk(validId(id));
    if (!lead) fail(404, 'NOT_FOUND', 'Prospect introuvable.');
    return lead;
  }
  const canEdit = (agent, lead) => isManager(agent) || lead.agentId === agent.id;

  return {
    // Scan d'un badge (`payload`) ou sélection manuelle d'une inscription (`registrationId`).
    async scan(agent, { payload, registrationId }) {
      const regId = payload !== undefined ? parseBadge(payload) : validId(registrationId);
      const registration = await Registration.findByPk(regId);
      if (!registration) fail(404, 'NOT_FOUND', 'Badge introuvable dans les inscriptions.');

      const result = await sequelize.transaction(async (transaction) => {
        const at = now();
        let created = false;
        let lead = await Lead.findOne({ where: { registrationId: regId }, transaction });
        if (!lead) {
          try {
            lead = await Lead.create(
              { registrationId: regId, agentId: agent.id, firstScannedAt: at, lastScannedAt: at, scanCount: 1, status: 'a_contacter' },
              { transaction },
            );
            created = true;
          } catch (error) {
            // Deux téléphones scannent la même personne en même temps : l'unicité tranche, on relit.
            if (error.name !== 'SequelizeUniqueConstraintError') throw error;
            lead = await Lead.findOne({ where: { registrationId: regId }, transaction });
          }
        }
        let duplicate = null;
        if (!created) {
          duplicate = {
            kind: lead.agentId === agent.id ? 'self' : 'other',
            firstScannedAt: iso(lead.firstScannedAt),
            previousScanCount: lead.scanCount,
          };
          await lead.increment('scanCount', { transaction });
          await lead.update({ lastScannedAt: at }, { transaction });
          await lead.reload({ transaction });
        }
        await Scan.create({ registrationId: regId, leadId: lead.id, agentId: agent.id, isDuplicate: !created }, { transaction });
        return { lead, duplicate };
      });

      // Un visiteur scanné par un commercial est forcément arrivé : l'arrivée est enregistrée si l'accueil ne l'a pas fait.
      try {
        await recordArrival(agent, regId, { rescan: false });
      } catch (error) {
        console.warn('[jpo-scanner] arrivée non enregistrée:', error.original?.sqlMessage || error.message);
      }

      const names = await agentNames([result.lead.agentId]);
      const view = leadView(result.lead, registration, names.get(result.lead.agentId));
      return {
        lead: view,
        mine: result.lead.agentId === agent.id,
        editable: canEdit(agent, result.lead),
        duplicate: result.duplicate && { ...result.duplicate, ownerName: view.agentName },
      };
    },

    // Poste « accueil » — ENTRÉE : arrivée d'un visiteur (badge scanné ou inscription choisie à la main).
    // outcome : 'arrived' (1re arrivée) · 'returned' (revient après une sortie) · 'already_inside'.
    async checkIn(agent, { payload, registrationId }) {
      if (!Checkin) fail(503, 'UNAVAILABLE', 'Enregistrement des arrivées indisponible.');
      const regId = payload !== undefined ? parseBadge(payload) : validId(registrationId);
      const registration = await Registration.findByPk(regId);
      if (!registration) fail(404, 'NOT_FOUND', 'Badge introuvable dans les inscriptions.');
      let row = (await arrivalsByRegistration([regId])).get(regId);
      let firstTime = false;
      if (row && !row.viaLead) {
        await row.increment('scanCount');
        await row.reload();
      } else if (!row) {
        const created = await recordArrival(agent, regId, { rescan: false });
        row = created.row;
        firstTime = created.firstTime;
      }
      const last = (await lastPassages([regId])).get(regId);
      const wasOut = Boolean(last) && last.direction === 'out';
      const outcome = firstTime ? 'arrived' : wasOut ? 'returned' : 'already_inside';
      if (Passage && outcome !== 'already_inside') {
        await Passage.create({ registrationId: regId, agentId: agent.id, direction: 'in' });
      }
      const names = await agentNames([row.agentId]);
      return {
        visitor: publicVisitor(registration),
        outcome,
        firstTime,
        checkedInAt: iso(row.checkedInAt),
        checkedInBy: names.get(row.agentId) || null,
        scanCount: row.scanCount,
      };
    },

    // Poste « accueil » — SORTIE : possible pour tout visiteur déjà arrivé (accueil OU scan d'un commercial).
    // outcome : 'left' · 'already_left'. Un visiteur jamais arrivé est refusé (409).
    async checkOut(agent, { payload, registrationId }) {
      if (!Checkin || !Passage) fail(503, 'UNAVAILABLE', 'Enregistrement des sorties indisponible.');
      const regId = payload !== undefined ? parseBadge(payload) : validId(registrationId);
      const registration = await Registration.findByPk(regId);
      if (!registration) fail(404, 'NOT_FOUND', 'Badge introuvable dans les inscriptions.');
      let arrival = (await arrivalsByRegistration([regId])).get(regId);
      // Jamais scanné nulle part : on ne bloque pas l'accueil en plein événement. La sortie est acceptée et
      // l'arrivée est ajoutée (nouvelle ligne, rien n'est modifié) ; `noArrival` le signale dans la réponse.
      let noArrival = false;
      if (!arrival) {
        arrival = (await recordArrival(agent, regId, { rescan: false })).row;
        noArrival = true;
      }
      const last = (await lastPassages([regId])).get(regId);
      if (last && last.direction === 'out') {
        const names = await agentNames([last.agentId]);
        return { visitor: publicVisitor(registration), outcome: 'already_left', leftAt: iso(last.created_at), leftBy: names.get(last.agentId) || null, checkedInAt: iso(arrival.checkedInAt) };
      }
      const passage = await Passage.create({ registrationId: regId, agentId: agent.id, direction: 'out' });
      return { visitor: publicVisitor(registration), outcome: 'left', leftAt: iso(passage.created_at), leftBy: agent.name, checkedInAt: iso(arrival.checkedInAt), noArrival };
    },

    async getLead(agent, id) {
      const lead = await loadLead(agent, id);
      const [regs, names] = await Promise.all([registrationsById([lead.registrationId]), agentNames([lead.agentId])]);
      return {
        lead: leadView(lead, regs.get(lead.registrationId), names.get(lead.agentId)),
        mine: lead.agentId === agent.id,
        editable: canEdit(agent, lead),
      };
    },

    async updateLead(agent, id, body) {
      const lead = await loadLead(agent, id);
      if (!canEdit(agent, lead)) fail(403, 'NOT_OWNER', 'Ce prospect est rattaché à un autre commercial.');
      const changes = parseLeadUpdate(body);
      if (!Object.keys(changes).length) fail(400, 'NOTHING_TO_UPDATE', 'Aucune modification à enregistrer.');
      if (!lead.treatedAt) changes.treatedAt = now();
      await lead.update(changes);
      return this.getLead(agent, id);
    },

    // Liste des prospects : les siens (défaut) ou, pour un manager, ceux de tous (scope=all).
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
      const order = query.filter === 'due'
        ? [['follow_up_at', 'ASC'], ['id', 'ASC']]
        : [['updated_at', 'DESC'], ['id', 'DESC']];
      const { rows, count } = await Lead.findAndCountAll({ where, order, limit, offset: (page - 1) * limit });
      const [regs, names] = await Promise.all([
        registrationsById(rows.map((r) => r.registrationId)),
        agentNames(rows.map((r) => r.agentId)),
      ]);
      return {
        items: rows.map((l) => leadView(l, regs.get(l.registrationId), names.get(l.agentId))),
        total: count,
        page,
        hasMore: page * limit < count,
      };
    },

    // Compteurs de l'accueil : mes prospects (ou ceux de tous pour un manager).
    async stats(agent) {
      if (agent.role === 'accueil') {
        // Arrivées = lignes d'arrivée (accueil, scan commercial) + prospects scannés sans ligne d'arrivée.
        const arrivalAt = new Map();
        if (Checkin) (await Checkin.findAll({ attributes: ['id', 'registrationId', 'checkedInAt'] })).forEach((r) => arrivalAt.set(r.registrationId, r.checkedInAt));
        (await Lead.findAll({ attributes: ['id', 'registrationId', 'firstScannedAt'] })).forEach((l) => {
          if (!arrivalAt.has(l.registrationId)) arrivalAt.set(l.registrationId, l.firstScannedAt);
        });
        const dayOf = (d) => new Date(new Date(d).getTime() + 3600000).toISOString().slice(0, 10);
        const today = dayOf(now());
        let arrivedToday = 0;
        for (const at of arrivalAt.values()) if (dayOf(at) === today) arrivedToday += 1;
        const lastByReg = new Map();
        if (Passage) (await Passage.findAll({ order: [['id', 'ASC']] })).forEach((p) => lastByReg.set(p.registrationId, p));
        let departed = 0;
        for (const id of arrivalAt.keys()) if (lastByReg.get(id)?.direction === 'out') departed += 1;
        return {
          arrived: arrivalAt.size, arrivedToday, departed, inside: arrivalAt.size - departed,
          registered: await Registration.count(), scope: 'reception', serverTime: now().toISOString(),
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
      const registered = await Registration.count();
      return { ...s, registered, scope: isManager(agent) ? 'all' : 'mine', serverTime: now().toISOString() };
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
      const { rows, count } = await Registration.findAndCountAll({
        where,
        order: [['created_at', 'DESC'], ['id', 'DESC']],
        limit,
        offset: (page - 1) * limit,
      });
      const leads = rows.length ? await Lead.findAll({ where: { registrationId: { [Op.in]: rows.map((r) => r.id) } } }) : [];
      const names = await agentNames(leads.map((l) => l.agentId));
      const byReg = new Map(leads.map((l) => [l.registrationId, l]));
      const arrivals = await arrivalsByRegistration(rows.map((r) => r.id));
      const lastById = await lastPassages(rows.map((r) => r.id));
      return {
        items: rows.map((r) => {
          const l = byReg.get(r.id);
          return { ...publicVisitor(r), leadId: l ? l.id : null, ownerName: l ? names.get(l.agentId) || null : null, mine: l ? l.agentId === agent.id : false, arrivedAt: arrivals.get(r.id) ? iso(arrivals.get(r.id).checkedInAt) : null, presence: presenceState(arrivals.get(r.id), lastById.get(r.id)) };
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
        const agent = await Agent.findByPk(validId(body.agentId));
        if (!agent) fail(404, 'AGENT_NOT_FOUND', 'Commercial introuvable.');
        if (agent.role === 'accueil') fail(400, 'INVALID_AGENT', 'Un compte accueil ne peut pas avoir de prospects.');
        changes.agentId = agent.id;
      }
      if (!Object.keys(changes).length) fail(400, 'NOTHING_TO_UPDATE', 'Aucune modification à enregistrer.');
      await lead.update(changes);
      return { id: lead.id };
    },
  };
}

module.exports = {
  createJpoScannerService,
  parseBadge,
  parseLeadUpdate,
  endOfTodayAlgiers,
  leadView,
  publicVisitor,
  validId,
  ScannerError,
  TEMPERATURES,
  STATUSES,
  CLOSED_STATUSES,
};
