'use strict';
const { pushLeadToOdoo } = require('./odooForms');
const { resolveResidenceId } = require('../data/odooResidences');
const { countryCodeFromPhone } = require('./odooJpoLead');

// Envoi vers Odoo (CRM) de TOUS les formulaires du site, avec le formulaire d'origine dans chaque lead.
//
// Point d'entrée unique : `notifyCrm(form, record, context)` (crmWebhook.js) est déjà appelé par chaque contrôleur
// de formulaire ; il appelle `pushFormToOdoo` ci-dessous. Un adaptateur par formulaire convertit
// l'enregistrement en base vers le format de l'endpoint Odoo /api/crm/lead.
//
// Champs envoyés EN PLUS du format historique (ignorés par Odoo tant que le contrôleur n'est pas mis à jour,
// cf. odoo_patch_formulaire.py) :
//   formulaire / formulaire_label : quel formulaire du site a amené le lead
//   message                       : texte libre + détails propres au formulaire
//   page_uri                      : page du site d'où vient l'envoi
//   utm_campaign / utm_source / utm_medium : source du lien d'arrivée, quand elle est connue
//
// Désactiver : ODOO_PUSH_FORMS=off. Exclure des formulaires : ODOO_SKIP_FORMS=newsletter,offres_ete

// Déjà envoyés à Odoo par leur propre contrôleur (avec leurs champs spécifiques) : pas de doublon ici.
const SELF_PUSHED = new Set(['quote', 'jpo_helenite']);
// Jamais envoyés : candidatures (RH) — des données de candidats, pas des prospects commerciaux.
const NEVER = new Set(['careers']);

const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());
const lines = (arr) => arr.map(clean).filter(Boolean).join('\n');
const labelled = (label, value) => (clean(value) ? `${label} : ${clean(value)}` : '');

function splitFullName(fullName) {
  const parts = clean(fullName).split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

const DAY_FR = { samedi: 'Samedi', dimanche: 'Dimanche', vendredi: 'Vendredi' };

// code du formulaire -> { label, build(record) -> champs communs }
// build renvoie : fullName | firstName/lastName, email, phone, message, country?, projectName?, interest?, projectStatus?,
//                 contactDays?, campaign?/source?/medium?
const FORMS = {
  contact: {
    label: 'Contact',
    build: (r) => ({ fullName: r.fullName, email: r.email, phone: r.phone, message: lines([labelled('Objet', r.subject), labelled('Type', r.type), r.message]) }),
  },
  home_contact: {
    label: "Contact — page d'accueil",
    build: (r) => ({ fullName: r.fullName, email: r.email, phone: r.phone, message: r.message }),
  },
  terrain_request: {
    label: 'Proposer un terrain',
    build: (r) => ({
      firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone,
      message: lines([labelled('Objet', r.subject), labelled('Adresse du terrain', r.landAddress), labelled('Façade', r.facade), labelled('Surface', r.area), labelled('Papiers', r.papers)]),
    }),
  },
  offres_ete: {
    label: 'Offres Été 2026',
    build: (r) => ({ fullName: r.fullName, email: r.email, phone: r.phone, message: labelled('Préférence de contact', r.preference) }),
  },
  visite_virtuelle_rdv: {
    label: 'Visite virtuelle — rendez-vous',
    build: (r) => ({ fullName: r.fullName, email: r.email, phone: r.phone, message: labelled('Localisations souhaitées', Array.isArray(r.localisations) ? r.localisations.join(', ') : r.localisations) }),
  },
  batimatech_lead: {
    label: 'Batimatech — prospect saisi par un commercial',
    build: (r) => ({
      firstName: r.prospectFirstName, lastName: r.prospectLastName, email: r.email, phone: r.phone, projectName: r.projectName,
      message: lines([labelled('Commercial', r.salesAgentName), labelled('Rendez-vous', [r.appointmentDate, r.appointmentSlot].filter(Boolean).join(' ')), r.note]),
    }),
  },
  concours_batitec: {
    label: 'Concours Batitec',
    build: (r) => ({ firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone, message: labelled('Catégorie', r.category) }),
  },
  batimat_2026: {
    label: 'BATIMAT 2026 — préinscription',
    build: (r) => ({
      firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone,
      message: labelled('Profil', r.profile), campaign: r.qrCampaign, source: r.qrSource,
    }),
  },
  batimat_after: {
    label: 'Batimat After — Paris',
    build: (r) => ({
      firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone,
      message: labelled('Jour souhaité', r.visitDay), campaign: r.qrCampaign, source: r.qrSource,
    }),
  },
  jpo_nice: {
    label: 'JPO Nice — « Nice, on arrive »',
    build: (r) => ({
      firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone, country: r.residenceCountry,
      contactDays: DAY_FR[r.visitDay] || '',
      interest: /duplex|penthouse/i.test(r.typology || '') ? 'Duplex' : r.typology ? 'Appartement' : '',
      projectStatus: { 'Immédiat / moins de 3 mois': 'Urgent', '3 à 6 mois': 'Moyen terme', '6 à 12 mois': 'Moyen terme', 'Plus de 12 mois': 'Long terme' }[r.horizon] || '',
      message: lines([
        labelled('Jour souhaité', { samedi: 'Samedi 31 octobre', dimanche: 'Dimanche 1er novembre', flexible: 'Flexible' }[r.visitDay]),
        labelled('Préférence horaire', { matin: 'Matin', apres_midi: 'Après-midi', flexible: 'Flexible', a_confirmer: 'À confirmer' }[r.timePref]),
        labelled('Ville', r.city), labelled('Profil', r.profile), labelled('Objectif', r.objective),
        labelled('Typologie', r.typology), labelled('Horizon', r.horizon), labelled('Question', r.message),
      ]),
      campaign: r.qrCampaign, source: r.qrSource, medium: r.qrMedium,
    }),
  },
  newsletter: {
    label: 'Newsletter',
    build: (r) => ({ email: r.email, message: labelled('Origine', r.source) }),
  },
};

// Enregistrement -> payload de /api/crm/lead. Toutes les clés exigées par l'endpoint sont toujours présentes.
function buildFormLead(form, record, context = {}) {
  const def = FORMS[form];
  if (!def) return null;
  const r = record && typeof record.toJSON === 'function' ? record.toJSON() : record || {};
  const d = def.build(r);

  const names = d.fullName ? splitFullName(d.fullName) : { firstName: clean(d.firstName), lastName: clean(d.lastName) };
  const emailLocal = clean(d.email).split('@')[0];
  // Odoo refuse un lead sans nom : repli sur l'e-mail (ex. newsletter) puis sur le nom du formulaire.
  const nom = names.lastName || names.firstName || emailLocal || def.label;
  const prenom = names.lastName ? names.firstName : '';

  const phone = clean(d.phone);
  const code = phone.startsWith('+') ? countryCodeFromPhone(phone) : null;
  let pays = clean(d.country);
  if (!pays && code) {
    try {
      pays = new Intl.DisplayNames(['fr'], { type: 'region' }).of(code) || '';
    } catch {
      pays = '';
    }
  }

  return {
    residence_id: d.projectName ? resolveResidenceId(d.projectName) : '',
    nom,
    prenom,
    pays,
    email: clean(d.email),
    telephone: phone,
    budget_estime: '',
    wilaya: '',
    profession: '',
    type_financement: '',
    interesse_par: clean(d.interest),
    localisation_souhaitee: '',
    jour_contact: clean(d.contactDays),
    heure_contact: '',
    statut_projet: clean(d.projectStatus),
    projet: clean(d.projectName),
    formulaire: form,
    formulaire_label: def.label,
    message: clean(d.message),
    page_uri: clean(context.pageUri),
    utm_campaign: clean(d.campaign),
    utm_source: clean(d.source),
    utm_medium: clean(d.medium),
  };
}

function skippedByConfig(form) {
  if (String(process.env.ODOO_PUSH_FORMS || '').toLowerCase() === 'off') return true;
  return String(process.env.ODOO_SKIP_FORMS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(form);
}

// Non bloquant : ne lève jamais, ne retarde jamais la réponse au visiteur.
function pushFormToOdoo(form, record, context = {}, { push = pushLeadToOdoo } = {}) {
  try {
    if (SELF_PUSHED.has(form) || NEVER.has(form) || skippedByConfig(form)) return;
    if (!process.env.ODOO_URL) return;
    const lead = buildFormLead(form, record, context);
    if (!lead) return;
    const id = record?.id ?? '?';
    push(lead)
      .then((res) => {
        if (res?.sent) console.log(`✅ [Odoo] ${form} #${id} poussé:`, JSON.stringify(res.result));
        else console.warn(`⚠️ [Odoo] ${form} #${id} NON poussé, raison:`, res?.reason, res?.error || '');
      })
      .catch((e) => console.warn(`❌ [Odoo] ${form} #${id} erreur:`, e?.message || e));
  } catch (e) {
    console.warn(`❌ [Odoo] ${form} non envoyé:`, e?.message || e);
  }
}

module.exports = { pushFormToOdoo, buildFormLead, FORMS, SELF_PUSHED, NEVER };
