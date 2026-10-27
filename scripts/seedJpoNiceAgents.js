// Crée les comptes de l'application de scan JPO Nice (4 commerciaux + 4 agents d'accueil) à partir de
// backend/data/jpoNiceAgents.json et écrit leurs identifiants (e-mail + mot de passe généré) dans un CSV.
//
//   node scripts/seedJpoNiceAgents.js                        -> crée les comptes manquants, écrit le CSV
//   node scripts/seedJpoNiceAgents.js --out /chemin/x.csv    -> choisit le fichier de sortie
//   node scripts/seedJpoNiceAgents.js --reset-existing       -> génère aussi un NOUVEAU mot de passe pour les comptes existants
//   node scripts/seedJpoNiceAgents.js --password "MotDePasse" -> MÊME mot de passe pour tous les comptes créés (8 caractères minimum)
//   node scripts/seedJpoNiceAgents.js --password-commercial "A" --password-accueil "B"
//                                                            -> un mot de passe pour les commerciaux, un autre pour l'accueil
//                                                               (avec --reset-existing : appliqués aussi aux comptes déjà créés)
//
// Sans option, un compte déjà présent n'est pas touché. Les mots de passe ne sont stockés qu'en hash : le CSV est le
// seul endroit où ils apparaissent en clair → le transmettre de façon sécurisée puis le SUPPRIMER du serveur.
// N'agit que sur les tables jpo_nice_* : les comptes de la JPO Hélénite ne sont pas concernés.

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const db = require('../src/models');
const { generatePassword, hashPassword } = require('../src/services/jpoAgentAuth');

const cap = (v) => String(v).trim().toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
};
const ROLE_LABELS = { manager: 'Manager', accueil: 'Accueil', commercial: 'Commercial' };

async function main() {
  const list = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'jpoNiceAgents.json'), 'utf8'));
  const outPath = path.resolve(arg('out') || `jpo-nice-comptes-${new Date().toISOString().slice(0, 10)}.csv`);
  const resetExisting = process.argv.includes('--reset-existing');
  const sharedPassword = arg('password');
  // Mots de passe par rôle (--password-commercial / --password-accueil) : prioritaires sur --password.
  const rolePasswords = { commercial: arg('password-commercial'), accueil: arg('password-accueil'), manager: arg('password-manager') };
  for (const value of [sharedPassword, ...Object.values(rolePasswords)]) {
    if (value !== null && value.length < 8) {
      console.error('Les mots de passe imposés doivent faire au moins 8 caractères.');
      process.exit(1);
    }
  }
  const imposed = (role) => rolePasswords[role] ?? sharedPassword;

  // Crée les tables Nice si elles n'existent pas encore (aucune table existante n'est modifiée).
  for (const model of [db.JpoNiceAgent, db.JpoNiceLead, db.JpoNiceScan, db.JpoNiceCheckin, db.JpoNicePassage]) await model.sync();

  const rows = [['Nom', 'Prénom', 'Rôle', 'Identifiant (e-mail)', 'Mot de passe']];
  let created = 0;
  let reset = 0;
  let skipped = 0;
  for (const person of list) {
    const email = person.email.trim().toLowerCase();
    const name = `${cap(person.firstName)} ${String(person.lastName).trim().toUpperCase()}`;
    const existing = await db.JpoNiceAgent.findOne({ where: { email } });
    if (existing && !resetExisting) {
      skipped += 1;
      console.log(`= ${email} existe déjà (inchangé)`);
      continue;
    }
    const password = imposed(person.role) || generatePassword();
    const passwordHash = await hashPassword(password);
    if (existing) {
      await existing.update({ passwordHash, name, role: person.role, active: true });
      reset += 1;
    } else {
      await db.JpoNiceAgent.create({ name, email, role: person.role, passwordHash, active: true });
      created += 1;
    }
    rows.push([String(person.lastName).toUpperCase(), cap(person.firstName), ROLE_LABELS[person.role] || person.role, email, password]);
  }

  const allImposed = list.every((p) => imposed(p.role));
  if (rows.length > 1 && allImposed) {
    console.log('Mots de passe imposés appliqués (aucun CSV). Identifiant = e-mail de chaque compte.');
  } else if (rows.length > 1) {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    fs.writeFileSync(outPath, `﻿${rows.map((r) => r.map(esc).join(';')).join('\n')}\n`, { mode: 0o600 });
    console.log(`\nIdentifiants écrits dans : ${outPath}\n→ à transmettre de façon sécurisée puis à SUPPRIMER du serveur.`);
  }
  console.log(`\nComptes créés : ${created} · mots de passe renouvelés : ${reset} · inchangés : ${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Erreur :', e.original?.sqlMessage || e.message);
  process.exit(1);
});
