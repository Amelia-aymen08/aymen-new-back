// Envoie vers Odoo des inscriptions JPO Hélénite déjà enregistrées en base (avant l'activation de l'envoi
// automatique, ou pendant une coupure d'Odoo). À lancer sur le serveur, depuis le dossier backend :
//
//   node scripts/resendJpoToOdoo.js --from-id 1            -> simulation : liste les inscriptions, n'envoie rien
//   node scripts/resendJpoToOdoo.js --from-id 1 --send     -> envoie réellement
//
// Options : --to-id <n> (borne haute), --delay <ms> entre deux envois (défaut 1500).
//
// ATTENTION doublons : Odoo ne dédoublonne pas. N'envoyer QUE les inscriptions qui n'y sont pas déjà
// (--from-id / --to-id), par exemple à partir de l'id de la première inscription faite après l'activation de l'envoi.

require('dotenv').config();
const { Op } = require('sequelize');
const db = require('../src/models');
const { pushLeadToOdoo } = require('../src/services/odooForms');
const { buildOdooLeadFromRegistration } = require('../src/services/odooJpoLead');

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
    console.error('Usage : node scripts/resendJpoToOdoo.js --from-id <id> [--to-id <id>] [--send]');
    process.exit(1);
  }

  const where = { id: { [Op.gte]: fromId, ...(toId ? { [Op.lte]: toId } : {}) } };
  const rows = await db.JpoHeleniteRegistration.findAll({ where, order: [['id', 'ASC']] });
  console.log(`${rows.length} inscription(s) trouvée(s) (id ${fromId}${toId ? ` à ${toId}` : ' et +'}) — mode : ${send ? 'ENVOI RÉEL' : 'simulation'}`);

  let ok = 0;
  let failed = 0;
  for (const r of rows) {
    const lead = buildOdooLeadFromRegistration(r);
    const label = `#${r.id} ${r.firstName} ${r.lastName} — ${r.visitDate} ${r.timeSlot} (pays : ${lead.pays || '?'})`;
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
        console.error('Odoo injoignable : arrêt pour ne pas enchaîner les échecs. Relancer quand la connexion est rétablie (--from-id', r.id, ').');
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  if (send) console.log(`Terminé : ${ok} envoyé(s), ${failed} en échec.`);
  else console.log('Simulation terminée — ajouter --send pour envoyer.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Erreur :', e?.message || e);
  process.exit(1);
});
