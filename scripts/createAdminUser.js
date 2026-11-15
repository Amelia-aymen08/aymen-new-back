// Crée (ou réinitialise) un compte du back-office blog.
//
//   node scripts/createAdminUser.js marketing@aymenpromotion.com "Prénom Nom"            -> rôle editor
//   node scripts/createAdminUser.js a.benelhadj@aymenpromotion.com "Nom" --role admin
//   node scripts/createAdminUser.js email@x.com --reset                                     -> nouveau mot de passe
//   node scripts/createAdminUser.js email@x.com --password "MotDePasseChoisi"               -> mot de passe imposé (10 car. min)
//
// Le mot de passe généré est affiché UNE seule fois dans le terminal (il n'est stocké qu'en hash).

require('dotenv').config();
const db = require('../src/models');
const { generatePassword, hashPassword } = require('../src/services/jpoAgentAuth');

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
};

async function main() {
  const [email, maybeName] = process.argv.slice(2);
  if (!email || !email.includes('@')) {
    console.error('Usage : node scripts/createAdminUser.js <email> ["Nom"] [--role admin|editor] [--reset] [--password X]');
    process.exit(1);
  }
  const name = maybeName && !maybeName.startsWith('--') ? maybeName : null;
  const role = arg('role') === 'admin' ? 'admin' : 'editor';
  const forced = arg('password');
  if (forced && forced.length < 10) {
    console.error('Mot de passe trop court (10 caractères minimum).');
    process.exit(1);
  }

  await db.sequelize.sync({ alter: false });
  const password = forced || generatePassword(14);
  const existing = await db.AdminUser.findOne({ where: { email: email.trim().toLowerCase() } });

  if (existing && !process.argv.includes('--reset') && !forced) {
    console.log(`Le compte ${existing.email} existe déjà (rôle ${existing.role}). Ajoutez --reset pour changer son mot de passe.`);
    return;
  }

  if (existing) {
    await existing.update({ passwordHash: await hashPassword(password), active: true, ...(arg('role') ? { role } : {}) });
    console.log(`Mot de passe réinitialisé pour ${existing.email}.`);
  } else {
    await db.AdminUser.create({ email, name, role, passwordHash: await hashPassword(password) });
    console.log(`Compte créé : ${email} (rôle ${role}).`);
  }
  if (!forced) console.log(`Mot de passe : ${password}\n→ à transmettre de façon sécurisée ; il ne sera plus affiché.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.sequelize.close());
