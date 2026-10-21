'use strict';
// Tests de la logique de scan JPO Hélénite avec des modèles en mémoire (aucune base requise) :
//   node --test backend/test/jpoScanner.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const {
  createJpoScannerService, parseBadge, parseLeadUpdate, endOfTodayAlgiers,
} = require('../src/services/jpoScannerService');
const { makeAuth, makeLimiter } = require('../src/middleware/requireJpoAgent');
const { hashPassword } = require('../src/services/jpoAgentAuth');

// --- mini ORM en mémoire -------------------------------------------------------------------------
function matches(row, where) {
  return Reflect.ownKeys(where || {}).every((key) => {
    const cond = where[key];
    if (key === Op.and) return cond.every((c) => matches(row, c));
    if (key === Op.or) return cond.some((c) => matches(row, c));
    const v = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if (Op.in in cond) return cond[Op.in].includes(v);
      if (Op.notIn in cond) return !cond[Op.notIn].includes(v);
      if (Op.lte in cond) return v != null && new Date(v) <= new Date(cond[Op.lte]);
      if (Op.like in cond) return String(v ?? '').toLowerCase().includes(String(cond[Op.like]).replace(/%/g, '').toLowerCase());
    }
    return cond === null ? v == null : v === cond;
  });
}
function makeModel(defaults = {}) {
  const rows = [];
  let seq = 0;
  const wrap = (data) => {
    const row = { ...data };
    row.update = async (changes) => Object.assign(row, changes);
    row.increment = async (field) => { row[field] += 1; };
    row.reload = async () => row;
    return row;
  };
  return {
    rows,
    create: async (data) => {
      const unique = data.registrationId;
      if (unique !== undefined && rows.some((r) => r.registrationId === unique) && defaults.uniqueRegistration) {
        const e = new Error('dup'); e.name = 'SequelizeUniqueConstraintError'; throw e;
      }
      const row = wrap({ id: ++seq, ...defaults.fields, ...data, created_at: new Date() });
      rows.push(row);
      return row;
    },
    findOne: async ({ where }) => rows.find((r) => matches(r, where)) || null,
    findByPk: async (id) => rows.find((r) => r.id === Number(id)) || null,
    findAll: async ({ where } = {}) => rows.filter((r) => matches(r, where)),
    findAndCountAll: async ({ where, limit, offset }) => {
      const all = rows.filter((r) => matches(r, where));
      return { rows: all.slice(offset, offset + limit), count: all.length };
    },
    count: async () => rows.length,
  };
}

function setup() {
  const Agent = makeModel();
  const Lead = makeModel({ uniqueRegistration: true, fields: { scanCount: 1, treatedAt: null, temperature: null, status: 'a_contacter' } });
  const Scan = makeModel();
  const Registration = makeModel();
  let clock = new Date('2026-10-24T09:00:00Z');
  const service = createJpoScannerService({
    Agent, Lead, Scan, Registration,
    sequelize: { transaction: async (fn) => fn({}) },
    now: () => clock,
  });
  return { Agent, Lead, Scan, Registration, service, setNow: (d) => { clock = d; } };
}

async function world() {
  const w = setup();
  const sara = await w.Agent.create({ name: 'Sara Test', email: 'sara@x.com', role: 'commercial', active: true });
  const karim = await w.Agent.create({ name: 'Karim Test', email: 'karim@x.com', role: 'commercial', active: true });
  const boss = await w.Agent.create({ name: 'Boss', email: 'boss@x.com', role: 'manager', active: true });
  const reg = await w.Registration.create({ firstName: 'Nadia', lastName: 'Ben', email: 'n@b.com', phone: '+213555000111', visitDate: '2026-10-24', timeSlot: '09h - 10h' });
  return { ...w, sara, karim, boss, reg };
}

test('parseBadge : accepte AYMEN-JPO26 et refuse le reste', () => {
  assert.equal(parseBadge('AYMEN-JPO26|12|Nadia|Ben'), 12);
  for (const bad of ['AYMEN-BA26|12|a|b', 'AYMEN-JPO26|0|a|b', 'AYMEN-JPO26|abc|a|b', 'AYMEN-JPO26|12|a', '', null]) {
    assert.throws(() => parseBadge(bad), { code: 'INVALID_QR' });
  }
});

test('premier scan : le prospect est rattaché au commercial avec la date du scan', async () => {
  const { service, sara, reg, Scan } = await world();
  const r = await service.scan(sara, { payload: `AYMEN-JPO26|${reg.id}|Nadia|Ben` });
  assert.equal(r.duplicate, null);
  assert.equal(r.mine, true);
  assert.equal(r.editable, true);
  assert.equal(r.lead.agentName, 'Sara Test');
  assert.equal(r.lead.firstScannedAt, '2026-10-24T09:00:00.000Z');
  assert.equal(r.lead.status, 'a_contacter');
  assert.equal(r.lead.visitor.email, 'n@b.com');
  assert.equal(Scan.rows.length, 1);
  assert.equal(Scan.rows[0].isDuplicate, false);
});

test('doublon : même commercial puis autre commercial', async () => {
  const { service, sara, karim, reg, Scan, Lead } = await world();
  await service.scan(sara, { registrationId: reg.id });
  const again = await service.scan(sara, { registrationId: reg.id });
  assert.equal(again.duplicate.kind, 'self');
  assert.equal(again.lead.scanCount, 2);
  const other = await service.scan(karim, { registrationId: reg.id });
  assert.equal(other.duplicate.kind, 'other');
  assert.equal(other.duplicate.ownerName, 'Sara Test');
  assert.equal(other.mine, false);
  assert.equal(other.editable, false);
  assert.equal(Lead.rows.length, 1, 'un seul prospect par inscription');
  assert.equal(Lead.rows[0].agentId, sara.id, 'le propriétaire ne change pas');
  assert.deepEqual(Scan.rows.map((s) => s.isDuplicate), [false, true, true]);
});

test('scan d’une inscription inconnue ou d’un QR invalide', async () => {
  const { service, sara } = await world();
  await assert.rejects(service.scan(sara, { registrationId: 999 }), { code: 'NOT_FOUND' });
  await assert.rejects(service.scan(sara, { payload: 'n importe quoi' }), { code: 'INVALID_QR' });
});

test('qualification : validations, note, température, statut, relance', async () => {
  const { service, sara, karim, boss, reg } = await world();
  const { lead } = await service.scan(sara, { registrationId: reg.id });
  const updated = await service.updateLead(sara, lead.id, {
    temperature: 'hot', rating: 4, status: 'rdv_a_confirmer', note: '  Veut un F4 vue mer ', nextAction: 'Rappeler jeudi',
    followUpAt: '2026-10-26T10:00:00.000Z',
  });
  assert.equal(updated.lead.temperature, 'hot');
  assert.equal(updated.lead.note, 'Veut un F4 vue mer');
  assert.equal(updated.lead.followUpAt, '2026-10-26T10:00:00.000Z');
  assert.ok(updated.lead.treatedAt, 'treatedAt posé à la première saisie');

  await assert.rejects(service.updateLead(sara, lead.id, { temperature: 'tiède' }), { code: 'INVALID_FIELD' });
  await assert.rejects(service.updateLead(sara, lead.id, { rating: 6 }), { code: 'INVALID_FIELD' });
  await assert.rejects(service.updateLead(sara, lead.id, { status: 'inconnu' }), { code: 'INVALID_FIELD' });
  await assert.rejects(service.updateLead(sara, lead.id, { followUpAt: 'pas une date' }), { code: 'INVALID_FIELD' });
  await assert.rejects(service.updateLead(sara, lead.id, {}), { code: 'NOTHING_TO_UPDATE' });
  // un autre commercial ne peut pas modifier, un manager si
  await assert.rejects(service.updateLead(karim, lead.id, { note: 'x' }), { code: 'NOT_OWNER' });
  const byBoss = await service.updateLead(boss, lead.id, { status: 'qualifie' });
  assert.equal(byBoss.lead.status, 'qualifie');
});

test('listes et compteurs : mes prospects, non traités, relances du jour', async () => {
  const w = await world();
  const { service, sara, karim, boss, Registration, setNow } = w;
  const regs = [w.reg];
  for (let i = 0; i < 3; i += 1) regs.push(await Registration.create({ firstName: `P${i}`, lastName: 'T', email: `p${i}@t.com`, phone: `+2135550${i}` }));
  const leads = [];
  for (const r of regs) leads.push((await service.scan(sara, { registrationId: r.id })).lead);
  const kReg = await Registration.create({ firstName: 'K', lastName: 'K', email: 'k@k.com', phone: '+213000' });
  await service.scan(karim, { registrationId: kReg.id });

  await service.updateLead(sara, leads[0].id, { temperature: 'hot', status: 'a_relancer', followUpAt: '2026-10-24T08:00:00.000Z' });
  await service.updateLead(sara, leads[1].id, { temperature: 'warm', status: 'rdv_confirme' });
  await service.updateLead(sara, leads[2].id, { temperature: 'cold', status: 'qualifie', followUpAt: '2026-10-24T08:00:00.000Z' });

  const stats = await service.stats(sara);
  assert.deepEqual(
    { scanned: stats.scanned, hot: stats.hot, warm: stats.warm, cold: stats.cold, untreated: stats.untreated, due: stats.due, appointments: stats.appointments },
    { scanned: 4, hot: 1, warm: 1, cold: 1, untreated: 1, due: 1, appointments: 1 },
  );
  assert.equal((await service.stats(boss)).scanned, 5, 'le manager voit tout');
  assert.equal((await service.listLeads(sara, {})).total, 4, 'un commercial ne voit que les siens');
  assert.equal((await service.listLeads(sara, { scope: 'all' })).total, 4, 'scope=all ignoré pour un commercial');
  assert.equal((await service.listLeads(boss, { scope: 'all' })).total, 5);
  assert.equal((await service.listLeads(sara, { filter: 'untreated' })).total, 1);
  assert.equal((await service.listLeads(sara, { filter: 'due' })).total, 1, 'relance dépassée et non clos');
  assert.equal((await service.listLeads(sara, { temperature: 'hot' })).items[0].temperature, 'hot');
  assert.equal((await service.listLeads(sara, { q: 'Nadia' })).total, 1);
  await assert.rejects(service.listLeads(sara, { q: '50%' }), { code: 'INVALID_QUERY' });
  setNow(new Date('2026-10-25T09:00:00Z'));
  assert.ok(true);
});

test('recherche manuelle : indique le commercial propriétaire', async () => {
  const { service, sara, karim, reg } = await world();
  await service.scan(sara, { registrationId: reg.id });
  const res = await service.searchRegistrations(karim, { q: 'nadia' });
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].ownerName, 'Sara Test');
  assert.equal(res.items[0].mine, false);
});

test('parseLeadUpdate : champs partiels, valeurs vides → null', () => {
  assert.deepEqual(parseLeadUpdate({ note: '   ', nextAction: null, temperature: null }), { note: null, nextAction: null, temperature: null });
  assert.deepEqual(parseLeadUpdate({ rating: 3 }), { rating: 3 });
});

test('endOfTodayAlgiers : fin de journée à Alger (UTC+1)', () => {
  assert.equal(endOfTodayAlgiers(new Date('2026-10-24T09:00:00Z')).toISOString(), '2026-10-24T22:59:59.999Z');
  assert.equal(endOfTodayAlgiers(new Date('2026-10-24T23:30:00Z')).toISOString(), '2026-10-25T22:59:59.999Z');
});

test('auth : Basic e-mail/mot de passe, compte inactif refusé, limiteur', async () => {
  const hash = await hashPassword('Secret123');
  const agents = {
    'a@x.com': { id: 1, name: 'A', email: 'a@x.com', role: 'commercial', active: true, passwordHash: hash },
    'off@x.com': { id: 2, name: 'Off', email: 'off@x.com', role: 'commercial', active: false, passwordHash: hash },
  };
  const auth = makeAuth({ findAgent: async (e) => agents[e] || null, limiter: makeLimiter() });
  const call = async (user, pass) => {
    const req = { headers: {}, socket: { remoteAddress: '1.1.1.1' }, get: () => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` };
    let status = 200; let next = false;
    const res = { status(c) { status = c; return this; }, json() { return this; }, set() {} };
    await auth(req, res, () => { next = true; });
    return { status, next, agent: req.jpoAgent };
  };
  const ok = await call('A@X.com', 'Secret123');
  assert.equal(ok.next, true);
  assert.equal(ok.agent.email, 'a@x.com');
  assert.equal((await call('a@x.com', 'mauvais')).status, 401);
  assert.equal((await call('off@x.com', 'Secret123')).status, 401);
  assert.equal((await call('inconnu@x.com', 'Secret123')).status, 401);
  for (let i = 0; i < 12; i += 1) await call('a@x.com', 'mauvais');
  assert.equal((await call('a@x.com', 'Secret123')).status, 429, 'bloqué après trop d’échecs');
});
