// Renvoie vers Odoo des devis déjà enregistrés en base mais jamais arrivés dans le CRM
// (ex. serveur injoignable). À lancer sur le serveur, depuis le dossier backend :
//
//   node scripts/resendQuotesToOdoo.js --from-id 4508            -> simulation : liste les devis, n'envoie rien
//   node scripts/resendQuotesToOdoo.js --from-id 4508 --send     -> envoie réellement
//
// Options : --to-id <n> (borne haute), --delay <ms> entre deux envois (défaut 1500).
//
// ATTENTION doublons : Odoo ne dédoublonne pas. Choisir --from-id / --to-id pour ne couvrir QUE
// les devis qui ont échoué (cf. `pm2 logs aymen-backend | grep "NON poussé"`), pas ceux déjà reçus.

require('dotenv').config();
const { Op } = require('sequelize');
const db = require('../src/models');
const { pushLeadToOdoo } = require('../src/services/odooForms');
const { buildOdooLead } = require('../src/services/odooQuoteLead');

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
};

async function main() {
  const fromId = parseInt(arg('from-id'), 10);
  const toId = parseInt(arg('to-id'), 10);
  const delay = parseInt(arg('delay'), 10) || 1500;
  const send = process.argv.includes('--send');

  if (!fromId) {
    console.error('Usage : node scripts/resendQuotesToOdoo.js --from-id <id> [--to-id <id>] [--send]');
    process.exit(1);
  }

  const where = { id: { [Op.gte]: fromId, ...(toId ? { [Op.lte]: toId } : {}) } };
  const quotes = await db.Quote.findAll({ where, order: [['id', 'ASC']] });
  console.log(`${quotes.length} devis trouvé(s) (id ${fromId}${toId ? ` à ${toId}` : ' et +'}) — mode : ${send ? 'ENVOI RÉEL' : 'simulation'}`);

  let ok = 0;
  let failed = 0;
  for (const q of quotes) {
    const lead = buildOdooLead(q);
    const label = `#${q.id} ${q.firstName} ${q.lastName} — ${q.sourceProject || '?'} (residence_id ${lead.residence_id || 'INCONNU'})`;
    if (!send) {
      console.log('•', label);
      continue;
    }
    const res = await pushLeadToOdoo(lead);
    if (res.sent) {
      ok += 1;
      console.log('✅', label, JSON.stringify(res.result));
    } else {
      failed += 1;
      console.warn('⚠️ ', label, '— échec :', res.reason, res.error || '');
      if (res.reason === 'error' && /timeout|ECONN|ENOTFOUND|EAI_AGAIN/i.test(res.error || '')) {
        console.error('Odoo injoignable : arrêt pour ne pas enchaîner les échecs. Relancer quand la connexion est rétablie (--from-id', q.id, ').');
        break;
      }
    }
    await new Promise((r) => setTimeout(r, delay));
  }

  if (send) console.log(`Terminé : ${ok} envoyé(s), ${failed} en échec.`);
  else console.log('Simulation terminée — ajouter --send pour envoyer.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Erreur :', e?.message || e);
  process.exit(1);
});
