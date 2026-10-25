'use strict';
// node --test backend/test/odooFormLeads.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFormLead, pushFormToOdoo, FORMS } = require('../src/services/odooFormLeads');
const { buildOdooLead } = require('../src/services/odooQuoteLead');
const { buildOdooLeadFromRegistration } = require('../src/services/odooJpoLead');

// Clés que le contrôleur Odoo (crm_lead_api.py) exige : leur absence renvoie « Champs manquants » (400).
const ODOO_REQUIRED = ['residence_id', 'nom', 'prenom', 'email', 'budget_estime', 'type_financement', 'telephone', 'profession', 'interesse_par', 'statut_projet'];

const SAMPLES = {
  contact: { id: 1, fullName: 'Karim Benali', email: 'k@b.dz', phone: '0555000111', subject: 'Visite', message: 'Bonjour', type: 'contact' },
  home_contact: { id: 2, fullName: 'Sara', email: 's@b.dz', phone: '+213555000222', message: 'Rappelez-moi' },
  terrain_request: { id: 3, firstName: 'Ali', lastName: 'Kaci', email: 'a@k.dz', phone: '0770000333', subject: 'Vente', landAddress: 'Kouba', facade: '20 m', area: '500 m²', papers: 'Acte' },
  offres_ete: { id: 4, fullName: 'Nadia Ben', email: 'n@b.dz', phone: '+213555000444', preference: 'whatsapp' },
  visite_virtuelle_rdv: { id: 5, fullName: 'Omar Z', email: 'o@z.dz', phone: '+33612345678', localisations: ['Kouba', 'Dely Ibrahim'] },
  batimatech_lead: { id: 6, prospectFirstName: 'Lina', prospectLastName: 'Amrani', phone: '0661000555', email: 'l@a.dz', projectName: 'AZURITE', salesAgentName: 'Hamza', appointmentDate: '2026-11-02', appointmentSlot: '10h', note: 'Intéressée F3' },
  concours_batitec: { id: 7, category: 'VILLA', firstName: 'Yacine', lastName: 'D', phone: '0550000666', email: 'y@d.dz' },
  batimat_2026: { id: 8, firstName: 'Mehdi', lastName: 'B', email: 'm@b.fr', phone: '+33699999999', profile: 'Investisseur', qrCampaign: 'batimat-bache', qrSource: 'print-qr' },
  batimat_after: { id: 9, firstName: 'Rania', lastName: 'M', email: 'r@m.fr', phone: '+33688888888', visitDay: 'samedi' },
  jpo_nice: { id: 10, firstName: 'Léa', lastName: 'Durand', email: 'lea@d.fr', phone: '+33612345678', residenceCountry: 'France', city: 'Nice', visitDay: 'dimanche', timePref: 'matin', profile: 'Investisseur', objective: 'Résidence secondaire', typology: 'F3', horizon: '3 à 6 mois', message: 'Budget 25M', qrCampaign: 'jpo-nice', qrSource: 'instagram', qrMedium: 'social' },
  newsletter: { id: 11, email: 'abonne@exemple.com', source: 'footer' },
};

test('chaque formulaire a un exemple et produit un lead complet', () => {
  for (const form of Object.keys(FORMS)) assert.ok(SAMPLES[form], `exemple manquant pour ${form}`);
  for (const [form, record] of Object.entries(SAMPLES)) {
    const lead = buildFormLead(form, record, { pageUri: 'https://aymenpromotion-dz.com/x' });
    for (const key of ODOO_REQUIRED) assert.ok(key in lead, `${form} : clé « ${key} » absente`);
    assert.ok(lead.nom.length > 0, `${form} : nom vide (Odoo refuserait le lead)`);
    assert.equal(lead.formulaire, form);
    assert.ok(lead.formulaire_label.length > 0);
    assert.equal(lead.page_uri, 'https://aymenpromotion-dz.com/x');
    for (const v of Object.values(lead)) assert.equal(typeof v, 'string', `${form} : valeur non textuelle`);
  }
});

test('noms : complet scindé, prénom/nom séparés, repli sur l’e-mail pour la newsletter', () => {
  const c = buildFormLead('contact', SAMPLES.contact);
  assert.deepEqual([c.prenom, c.nom], ['Karim', 'Benali']);
  const t = buildFormLead('terrain_request', SAMPLES.terrain_request);
  assert.deepEqual([t.prenom, t.nom], ['Ali', 'Kaci']);
  const n = buildFormLead('newsletter', SAMPLES.newsletter);
  assert.equal(n.nom, 'abonne');
  assert.equal(n.prenom, '');
  assert.equal(buildFormLead('home_contact', { fullName: 'Sara', email: 's@b.dz' }).nom, 'Sara');
});

test('projet reconnu -> residence_id ; pays déduit d’un numéro international ; message détaillé', () => {
  const b = buildFormLead('batimatech_lead', SAMPLES.batimatech_lead);
  assert.equal(b.residence_id, '2');
  assert.match(b.message, /Commercial : Hamza/);
  assert.equal(buildFormLead('visite_virtuelle_rdv', SAMPLES.visite_virtuelle_rdv).pays, 'France');
  assert.equal(buildFormLead('contact', SAMPLES.contact).pays, '', 'numéro local : pays laissé à Odoo (pays par défaut)');
  assert.match(buildFormLead('visite_virtuelle_rdv', SAMPLES.visite_virtuelle_rdv).message, /Kouba, Dely Ibrahim/);
});

test('JPO Nice : jour, typologie, horizon et source du lien', () => {
  const l = buildFormLead('jpo_nice', SAMPLES.jpo_nice);
  assert.equal(l.pays, 'France');
  assert.equal(l.jour_contact, 'Dimanche');
  assert.equal(l.interesse_par, 'Appartement');
  assert.equal(l.statut_projet, 'Moyen terme');
  assert.deepEqual([l.utm_campaign, l.utm_source, l.utm_medium], ['jpo-nice', 'instagram', 'social']);
  assert.match(l.message, /Jour souhaité : Dimanche 1er novembre/);
});

test('devis et JPO Hélénite gardent leur propre envoi mais indiquent leur formulaire', () => {
  const quote = buildOdooLead({ sourceProject: 'AZURITE', lastName: 'L', firstName: 'F', formulaire: 'devis_projet', formulaireLabel: 'Devis — page projet AZURITE', pageUri: 'https://x/y' });
  assert.equal(quote.formulaire, 'devis_projet');
  assert.equal(quote.residence_id, '2');
  const jpo = buildOdooLeadFromRegistration({ firstName: 'Nadia', lastName: 'Ben', email: 'n@b.com', phone: '+213555000111', visitDate: '2026-10-24', timeSlot: '09h - 10h', typology: 'F4', horizon: '3 à 6 mois', message: 'Vue mer', qrSource: 'commerciaux', qrMedium: 'link', qrCampaign: 'jpo-helenite' }, { countryCode: 'DZ' });
  assert.equal(jpo.formulaire, 'jpo_helenite');
  assert.match(jpo.message, /Visite souhaitée : Samedi 2026-10-24 · 09h - 10h/);
  assert.equal(jpo.utm_source, 'commerciaux');
});

test('envoi : une seule poussée par formulaire, exclusions et interrupteurs', async () => {
  process.env.ODOO_URL = 'http://127.0.0.1:1';
  const sent = [];
  const push = async (lead) => { sent.push(lead.formulaire); return { sent: true, result: { ok: 1 } }; };
  const flush = () => new Promise((r) => setImmediate(r));

  pushFormToOdoo('contact', SAMPLES.contact, {}, { push });
  pushFormToOdoo('jpo_nice', SAMPLES.jpo_nice, {}, { push });
  pushFormToOdoo('careers', { id: 1, firstName: 'X' }, {}, { push });        // candidatures : jamais
  pushFormToOdoo('quote', { id: 1 }, {}, { push });                           // déjà envoyé par son contrôleur
  pushFormToOdoo('jpo_helenite', { id: 1 }, {}, { push });                    // idem
  pushFormToOdoo('formulaire_inconnu', { id: 1 }, {}, { push });
  await flush();
  assert.deepEqual(sent.sort(), ['contact', 'jpo_nice']);

  sent.length = 0;
  process.env.ODOO_SKIP_FORMS = 'newsletter, offres_ete';
  pushFormToOdoo('newsletter', SAMPLES.newsletter, {}, { push });
  pushFormToOdoo('home_contact', SAMPLES.home_contact, {}, { push });
  await flush();
  assert.deepEqual(sent, ['home_contact']);

  sent.length = 0;
  process.env.ODOO_PUSH_FORMS = 'off';
  pushFormToOdoo('contact', SAMPLES.contact, {}, { push });
  await flush();
  assert.deepEqual(sent, []);
  delete process.env.ODOO_PUSH_FORMS;
  delete process.env.ODOO_SKIP_FORMS;

  // un échec d'Odoo ne se propage jamais
  assert.doesNotThrow(() => pushFormToOdoo('contact', SAMPLES.contact, {}, { push: async () => { throw new Error('boom'); } }));
  assert.doesNotThrow(() => pushFormToOdoo('contact', null, {}, { push }));
  await flush();
});
