'use strict';
// Tests de la logique de scan JPO Nice avec des modèles en mémoire (aucune base requise) :
//   node --test backend/test/jpoNiceScanner.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { createJpoNiceScannerService, parseBadge } = require('../src/services/jpoNiceScannerService');

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
      if (data.registrationId !== undefined && rows.some((r) => r.registrationId === data.registrationId) && defaults.uniqueRegistration) {
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

async function world() {
  const Agent = makeModel({ fields: { availability: 'available' } });
  const Lead = makeModel({ uniqueRegistration: true, fields: { scanCount: 1, treatedAt: null, temperature: null, status: 'a_contacter', assignedById: null } });
  const Scan = makeModel();
  const Registration = makeModel();
  const Checkin = makeModel({ uniqueRegistration: true, fields: { scanCount: 1 } });
  const Passage = makeModel();
  const service = createJpoNiceScannerService({
    Agent, Lead, Scan, Registration, Checkin, Passage,
    sequelize: { transaction: async (fn) => fn({}) },
    now: () => new Date('2026-10-31T10:00:00Z'),
  });
  const yacine = await Agent.create({ name: 'Yacine DJEZAR', email: 'y@x.com', role: 'commercial', active: true });
  const hichem = await Agent.create({ name: 'Hichem HAMIDI', email: 'h@x.com', role: 'commercial', active: true });
  const neila = await Agent.create({ name: 'Neila OUADAH', email: 'n@x.com', role: 'commercial', active: true });
  const desk = await Agent.create({ name: 'Accueil NICE 1', email: 'a1@x.com', role: 'accueil', active: true });
  const desk2 = await Agent.create({ name: 'Accueil NICE 2', email: 'a2@x.com', role: 'accueil', active: true });
  const boss = await Agent.create({ name: 'Boss', email: 'b@x.com', role: 'manager', active: true });
  const reg = await Registration.create({
    firstName: 'Léa', lastName: 'Durand', email: 'l@d.fr', phone: '+33612345678', visitDay: 'samedi', timePref: 'matin', qrToken: 'a'.repeat(32),
  });
  const reg2 = await Registration.create({
    firstName: 'Karim', lastName: 'B', email: 'k@b.fr', phone: '+33698765432', visitDay: 'flexible', timePref: 'a_confirmer', qrToken: 'b'.repeat(32),
  });
  return { Agent, Lead, Scan, Registration, Checkin, Passage, service, yacine, hichem, neila, desk, desk2, boss, reg, reg2 };
}
const badge = (reg) => `AYMEN-NICE26|${reg.qrToken}|${reg.firstName}|${reg.lastName}`;

test('parseBadge : accepte AYMEN-NICE26 et refuse le reste (dont un badge Hélénite)', () => {
  assert.equal(parseBadge(`AYMEN-NICE26|${'A'.repeat(32)}|Léa|Durand`), 'a'.repeat(32));
  for (const bad of ['AYMEN-JPO26|12|a|b', 'AYMEN-NICE26|zz|a|b', 'AYMEN-NICE26|' + 'a'.repeat(32) + '|a', '', null]) {
    assert.throws(() => parseBadge(bad), { code: 'INVALID_QR' });
  }
});

test('accueil : sans commercial choisi, rien n’est écrit et on reçoit la liste avec disponibilité', async () => {
  const { service, desk, reg, yacine, hichem, Lead, Checkin } = await world();
  await service.setAvailability(hichem, 'busy');
  const r = await service.checkIn(desk, { payload: badge(reg) });
  assert.equal(r.outcome, 'choose_agent');
  assert.equal(r.visitor.visitLabel, 'Samedi 31/10 · Matin');
  assert.equal(r.commercials.length, 3, 'les 3 commerciaux actifs (pas l’accueil ni le manager)');
  assert.equal(r.commercials[0].availability, 'available', 'les disponibles en premier');
  assert.equal(r.commercials.at(-1).id, hichem.id, 'l’occupé en dernier');
  assert.ok(r.commercials.some((c) => c.id === yacine.id));
  assert.equal(Lead.rows.length, 0);
  assert.equal(Checkin.rows.length, 0);
});

test('accueil : l’arrivée affecte le visiteur au commercial choisi', async () => {
  const { service, desk, reg, hichem, Lead, Checkin, Passage } = await world();
  const r = await service.checkIn(desk, { payload: badge(reg), agentId: hichem.id });
  assert.equal(r.outcome, 'arrived');
  assert.equal(r.assigned.name, 'Hichem HAMIDI');
  assert.equal(r.assigned.byName, 'Accueil NICE 1');
  assert.equal(Lead.rows.length, 1);
  assert.equal(Lead.rows[0].agentId, hichem.id);
  assert.equal(Lead.rows[0].assignedById, desk.id);
  assert.equal(Checkin.rows.length, 1);
  assert.deepEqual(Passage.rows.map((p) => p.direction), ['in']);
});

test('accueil : on ne peut affecter qu’à un commercial actif', async () => {
  const { service, desk, reg, desk2, boss, Agent, yacine } = await world();
  await assert.rejects(service.checkIn(desk, { registrationId: reg.id, agentId: desk2.id }), { code: 'AGENT_NOT_FOUND' });
  await assert.rejects(service.checkIn(desk, { registrationId: reg.id, agentId: boss.id }), { code: 'AGENT_NOT_FOUND' });
  await assert.rejects(service.checkIn(desk, { registrationId: reg.id, agentId: 9999 }), { code: 'AGENT_NOT_FOUND' });
  await yacine.update({ active: false });
  await assert.rejects(service.checkIn(desk, { registrationId: reg.id, agentId: yacine.id }), { code: 'AGENT_NOT_FOUND' });
  assert.ok(Agent);
});

test('accueil : un visiteur déjà affecté n’est pas réaffecté (message avec clin d’œil)', async () => {
  const { service, desk, desk2, reg, hichem, neila, Lead } = await world();
  await service.checkIn(desk, { payload: badge(reg), agentId: hichem.id });
  const again = await service.checkIn(desk2, { payload: badge(reg), agentId: neila.id });
  assert.equal(again.outcome, 'already_inside');
  assert.equal(again.assigned.name, 'Hichem HAMIDI');
  assert.match(again.message, /😉/);
  assert.match(again.message, /Hichem HAMIDI/);
  assert.equal(Lead.rows.length, 1);
  assert.equal(Lead.rows[0].agentId, hichem.id, 'le propriétaire ne change pas');
  // sans commercial choisi : même réponse, pas de liste de choix
  const noChoice = await service.checkIn(desk2, { payload: badge(reg) });
  assert.equal(noChoice.outcome, 'already_inside');
});

test('commercial : un visiteur déjà checké par un collègue est bloqué avec un clin d’œil, rien n’est modifié', async () => {
  const { service, desk, reg, hichem, neila, Lead, Scan } = await world();
  await service.checkIn(desk, { payload: badge(reg), agentId: hichem.id });
  const r = await service.scan(neila, { payload: badge(reg) });
  assert.ok(r.blocked);
  assert.equal(r.blocked.ownerName, 'Hichem HAMIDI');
  assert.equal(r.blocked.assignedByName, 'Accueil NICE 1');
  assert.match(r.blocked.message, /😉/);
  assert.match(r.blocked.message, /déjà passé chez Hichem HAMIDI/);
  assert.equal(r.lead, undefined, 'aucune fiche exposée à l’autre commercial');
  assert.equal(Lead.rows.length, 1);
  assert.equal(Lead.rows[0].agentId, hichem.id);
  assert.equal(Lead.rows[0].scanCount, 1, 'le prospect n’est pas touché');
  assert.equal(Scan.rows.at(-1).isDuplicate, true, 'la tentative est journalisée');
});

test('commercial : il retrouve le visiteur que l’accueil lui a affecté', async () => {
  const { service, desk, reg, hichem } = await world();
  await service.checkIn(desk, { payload: badge(reg), agentId: hichem.id });
  const r = await service.scan(hichem, { payload: badge(reg) });
  assert.equal(r.mine, true);
  assert.equal(r.editable, true);
  assert.equal(r.assignedByReception, true);
  assert.equal(r.lead.visitor.email, 'l@d.fr');
  assert.equal(r.duplicate.kind, 'self');
});

test('commercial : un visiteur non affecté devient son prospect (arrivée enregistrée), le suivant est bloqué', async () => {
  const { service, reg2, hichem, neila, Lead, Checkin } = await world();
  const first = await service.scan(hichem, { payload: badge(reg2) });
  assert.equal(first.mine, true);
  assert.equal(first.duplicate, null);
  assert.equal(first.assignedByReception, false);
  assert.equal(Checkin.rows.length, 1);
  const second = await service.scan(neila, { registrationId: reg2.id });
  assert.ok(second.blocked);
  assert.equal(Lead.rows.length, 1);
});

test('manager : peut ouvrir et modifier le prospect d’un commercial', async () => {
  const { service, desk, reg, hichem, boss } = await world();
  await service.checkIn(desk, { payload: badge(reg), agentId: hichem.id });
  const r = await service.scan(boss, { payload: badge(reg) });
  assert.equal(r.blocked, undefined);
  assert.equal(r.editable, true);
  assert.equal(r.mine, false);
});

test('qualification : propriétaire seulement ; statut et température validés', async () => {
  const { service, desk, reg, hichem, neila } = await world();
  const { lead } = (await service.checkIn(desk, { payload: badge(reg), agentId: hichem.id })) && (await service.scan(hichem, { payload: badge(reg) }));
  const updated = await service.updateLead(hichem, lead.id, { temperature: 'hot', rating: 5, status: 'rdv_confirme', note: ' Veut un F3 ' });
  assert.equal(updated.lead.temperature, 'hot');
  assert.equal(updated.lead.note, 'Veut un F3');
  assert.ok(updated.lead.treatedAt);
  await assert.rejects(service.updateLead(neila, lead.id, { temperature: 'cold' }), { code: 'NOT_OWNER' });
  await assert.rejects(service.updateLead(hichem, lead.id, { temperature: 'tiède' }), { code: 'INVALID_FIELD' });
  await assert.rejects(service.updateLead(hichem, lead.id, {}), { code: 'NOTHING_TO_UPDATE' });
});

test('disponibilité : visible de l’accueil, charge = prospects en attente', async () => {
  const { service, desk, reg, reg2, hichem, neila } = await world();
  await service.checkIn(desk, { payload: badge(reg), agentId: hichem.id });
  await service.checkIn(desk, { payload: badge(reg2), agentId: hichem.id });
  const { lead } = await service.scan(hichem, { payload: badge(reg) });
  await service.updateLead(hichem, lead.id, { status: 'contacte' });
  await service.setAvailability(neila, 'break');
  await assert.rejects(service.setAvailability(neila, 'dormir'), { code: 'INVALID_FIELD' });
  const board = await service.commercialsBoard();
  const h = board.find((c) => c.id === hichem.id);
  assert.deepEqual([h.assigned, h.waiting, h.treated], [2, 1, 1]);
  assert.equal(board.find((c) => c.id === neila.id).availabilityLabel, 'En pause');
  assert.equal(board.at(-1).id, neila.id, 'en pause = en dernier');
  assert.equal((await service.stats(hichem)).availability, 'available');
});

test('entrée / sortie / retour', async () => {
  const { service, desk, reg, hichem, Passage } = await world();
  await service.checkIn(desk, { payload: badge(reg), agentId: hichem.id });
  const out = await service.checkOut(desk, { payload: badge(reg) });
  assert.equal(out.outcome, 'left');
  assert.equal((await service.checkOut(desk, { payload: badge(reg) })).outcome, 'already_left');
  const back = await service.checkIn(desk, { payload: badge(reg) });
  assert.equal(back.outcome, 'returned');
  assert.equal(back.assigned.name, 'Hichem HAMIDI');
  assert.deepEqual(Passage.rows.map((p) => p.direction), ['in', 'out', 'in']);
  const stats = await service.stats(desk);
  assert.equal(stats.arrived, 1);
  assert.equal(stats.inside, 1);
  assert.equal(stats.registered, 2);
  assert.equal(stats.commercials.length, 3);
});

test('sortie d’un visiteur jamais vu : acceptée et signalée', async () => {
  const { service, desk, reg2 } = await world();
  const out = await service.checkOut(desk, { registrationId: reg2.id });
  assert.equal(out.outcome, 'left');
  assert.equal(out.noArrival, true);
});

test('badge inconnu ou QR invalide', async () => {
  const { service, desk, hichem } = await world();
  await assert.rejects(service.checkIn(desk, { payload: `AYMEN-NICE26|${'c'.repeat(32)}|a|b` }), { code: 'NOT_FOUND' });
  await assert.rejects(service.scan(hichem, { payload: 'AYMEN-JPO26|1|a|b' }), { code: 'INVALID_QR' });
});

test('liste des prospects : les siens seulement ; recherche ; statuts', async () => {
  const { service, desk, reg, reg2, hichem, neila } = await world();
  await service.checkIn(desk, { payload: badge(reg), agentId: hichem.id });
  await service.checkIn(desk, { payload: badge(reg2), agentId: neila.id });
  const mine = await service.listLeads(hichem, {});
  assert.equal(mine.total, 1);
  assert.equal(mine.items[0].visitor.firstName, 'Léa');
  assert.equal(mine.items[0].assignedByName, 'Accueil NICE 1');
  assert.equal((await service.listLeads(hichem, { filter: 'untreated' })).total, 1);
  assert.equal((await service.listLeads(hichem, { q: 'durand' })).total, 1);
  assert.equal((await service.listLeads(hichem, { q: 'karim' })).total, 0);
});

test('recherche manuelle : état de présence et propriétaire', async () => {
  const { service, desk, reg, hichem } = await world();
  await service.checkIn(desk, { payload: badge(reg), agentId: hichem.id });
  const res = await service.searchRegistrations(desk, {});
  const a = res.items.find((i) => i.id === reg.id);
  assert.equal(a.presence, 'inside');
  assert.equal(a.ownerName, 'Hichem HAMIDI');
  assert.equal(res.items.find((i) => i.presence === 'registered').firstName, 'Karim');
});

test('admin : réaffectation vers un commercial, jamais vers l’accueil', async () => {
  const { service, desk, reg, hichem, neila } = await world();
  await service.checkIn(desk, { payload: badge(reg), agentId: hichem.id });
  const { lead } = await service.scan(hichem, { payload: badge(reg) });
  await service.adminUpdateLead(lead.id, { agentId: neila.id });
  assert.equal((await service.getLead(neila, lead.id)).mine, true);
  await assert.rejects(service.adminUpdateLead(lead.id, { agentId: desk.id }), { code: 'INVALID_AGENT' });
});
