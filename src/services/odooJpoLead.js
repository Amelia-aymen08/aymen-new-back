const { buildOdooLead } = require('./odooQuoteLead');
const { COUNTRY_DIAL_CODES } = require('../data/countryDialCodes');

// Inscription JPO Hélénite -> lead Odoo, avec les MÊMES formats de valeurs que le formulaire de devis des
// pages projets (libellés français : « Appartement », « Samedi », « Matin (9h-12h) », « Urgent »…).
// Odoo ignore sans erreur une valeur qu'il ne reconnaît pas ; seuls les champs que la JPO collecte sont envoyés.

const FR_WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// Jour de visite « 2026-10-24 » -> « Samedi ».
function weekdayFr(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  return FR_WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

// Créneau « 15h - 16h » -> libellé « Heure de contact préférée » du devis.
function contactTimeLabel(slot) {
  const hour = parseInt(String(slot || '').slice(0, 2), 10);
  if (Number.isNaN(hour)) return '';
  if (hour < 12) return 'Matin (9h-12h)';
  if (hour < 17) return 'Après-midi (13h-17h)';
  return 'Soir (17h-20h)';
}

// Typologie recherchée -> « Intéressé par » du devis (Appartement | Duplex | Local Commercial | Bureau).
function interestLabel(typology) {
  if (!typology || typology === 'À définir') return '';
  return /duplex|penthouse/i.test(typology) ? 'Duplex' : 'Appartement';
}

// Horizon du projet -> « Statut du projet » du devis (Urgent | Moyen terme | Long terme).
function projectStatusLabel(horizon) {
  switch (horizon) {
    case 'Immédiat / moins de 3 mois': return 'Urgent';
    case '3 à 6 mois':
    case '6 à 12 mois': return 'Moyen terme';
    case 'Plus de 12 mois': return 'Long terme';
    default: return '';
  }
}

function countryName(code) {
  if (!code) return '';
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

// Pays déduit d'un numéro « +213… » (plus long indicatif d'abord) : sert au renvoi des inscriptions déjà en base,
// dont l'indicatif choisi n'est pas conservé.
function countryCodeFromPhone(phone) {
  const p = String(phone || '');
  let best = null;
  for (const [code, dial] of Object.entries(COUNTRY_DIAL_CODES)) {
    if (p.startsWith(dial) && (!best || dial.length > COUNTRY_DIAL_CODES[best].length)) best = code;
  }
  return best;
}

function buildOdooLeadFromRegistration(reg, { countryCode } = {}) {
  return buildOdooLead({
    sourceProject: 'HÉLÉNITE',
    lastName: reg.lastName,
    firstName: reg.firstName,
    country: countryName(countryCode || countryCodeFromPhone(reg.phone)),
    email: reg.email,
    phone: reg.phone,
    interest: interestLabel(reg.typology),
    contactDays: weekdayFr(reg.visitDate),
    contactTime: contactTimeLabel(reg.timeSlot),
    projectStatus: projectStatusLabel(reg.horizon),
    formulaire: 'jpo_helenite',
    formulaireLabel: 'JPO Hélénite — avant-première',
    message: [
      `Visite souhaitée : ${weekdayFr(reg.visitDate)} ${reg.visitDate || ''} · ${reg.timeSlot || ''}`.trim(),
      reg.profile ? `Profil : ${reg.profile}` : '',
      reg.typology ? `Typologie : ${reg.typology}` : '',
      reg.horizon ? `Horizon : ${reg.horizon}` : '',
      reg.message ? `Question : ${reg.message}` : '',
    ].filter(Boolean).join('\n'),
    utmCampaign: reg.qrCampaign || '',
    utmSource: reg.qrSource || '',
    utmMedium: reg.qrMedium || '',
  });
}

module.exports = { buildOdooLeadFromRegistration, weekdayFr, contactTimeLabel, interestLabel, projectStatusLabel, countryCodeFromPhone };
