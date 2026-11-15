// Importe dans le nouveau blog les articles récupérés de l'ancien Strapi (réponse JSON de
// /api/blogs?populate=* sauvegardée sur archive.org).
//
//   node scripts/importStrapiBlog.js data/strapi_blogs_20250416.json             -> importe en BROUILLON (défaut)
//   node scripts/importStrapiBlog.js data/strapi_blogs_20250416.json --publish   -> importe directement en publié
//   node scripts/importStrapiBlog.js fichier.json --dry-run                      -> affiche sans rien écrire
//
// Brouillon par défaut : les images ayant été perdues, le marketing relit et complète
// chaque article dans le dashboard (/admin/blog) avant de le publier.
//
// - Le slug d'origine est conservé : les anciennes URLs /blog/<slug> restent valides (SEO).
// - Un article dont le slug existe déjà est ignoré (le script peut être relancé sans doublon).
// - Les images étaient hébergées sur l'ancien Strapi et sont perdues : couverture vide
//   (le site affiche une image par défaut) et images internes retirées du contenu.

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const db = require('../src/models');
const { strapiBlocksToHtml } = require('../src/services/blogHtml');

const CATEGORY_MAP = {
  'événement': 'evenement',
  'aménagement et décoration': 'amenagement-decoration',
  investissement: 'investissement',
  'achat et vente': 'achat-vente',
  'style de vie': 'style-de-vie',
  'gestion de copropriété': 'gestion-copropriete',
};

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage : node scripts/importStrapiBlog.js <fichier.json> [--publish] [--dry-run]');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');
  const status = process.argv.includes('--publish') ? 'published' : 'draft';
  const json = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const items = Array.isArray(json) ? json : json.data;

  if (!dryRun) await db.sequelize.sync({ alter: false });

  let created = 0;
  let skipped = 0;
  let images = 0;
  for (const item of items) {
    const a = item.attributes || item;
    const slug = String(a.slug || '').trim();
    if (!slug || !a.titre) {
      skipped += 1;
      continue;
    }
    if (!dryRun && (await db.BlogPost.findOne({ where: { slug } }))) {
      console.log(`= déjà présent : ${slug}`);
      skipped += 1;
      continue;
    }
    const { html, droppedImages } = strapiBlocksToHtml(a.article || []);
    images += droppedImages;
    const meta = Array.isArray(a.metadata) ? a.metadata[0] : a.metadata;
    const post = {
      slug,
      status,
      category: CATEGORY_MAP[a.category] || 'style-de-vie',
      coverImage: null,
      author: a.auteur || 'Aymen Promotion',
      publishedAt: a.date ? new Date(`${a.date}T09:00:00Z`) : new Date(a.publishedAt || Date.now()),
      legacySource: 'strapi-archive',
    };
    const fr = {
      locale: 'fr',
      title: String(a.titre).trim(),
      excerpt: a.description || null,
      contentHtml: html,
      metaTitle: meta?.metaTitle || null,
      metaDescription: meta?.metaDescription ? String(meta.metaDescription).slice(0, 500) : null,
    };

    if (dryRun) {
      console.log(`+ ${slug} [${post.category}] ${html.length} car. HTML, ${droppedImages} image(s) retirée(s)`);
      created += 1;
      continue;
    }
    await db.sequelize.transaction(async (transaction) => {
      const p = await db.BlogPost.create(post, { transaction });
      await db.BlogPostTranslation.create({ ...fr, postId: p.id }, { transaction });
    });
    console.log(`+ importé : ${slug}`);
    created += 1;
  }
  console.log(`\n${created} article(s) ${dryRun ? 'à importer' : 'importé(s)'}, ${skipped} ignoré(s), ${images} image(s) interne(s) perdue(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.sequelize.close());
