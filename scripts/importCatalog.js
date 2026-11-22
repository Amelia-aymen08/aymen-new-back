// Importe en base les projets et localités du site (export de mockData.ts), pour qu'ils soient
// ensuite gérés depuis le dashboard (/admin/projets, /admin/localites).
//
//   node scripts/importCatalog.js data/catalog_site_20261122.json --dry-run    -> affiche sans rien écrire
//   node scripts/importCatalog.js data/catalog_site_20261122.json              -> crée les absents, complète les champs vides
//   node scripts/importCatalog.js data/catalog_site_20261122.json --overwrite  -> écrase aussi les champs remplis
//
// À la première mise en place, lancer avec --overwrite : les projets déjà en base (créés pour
// l'application mobile) ont des avancements anciens. Ensuite, NE PLUS utiliser --overwrite :
// les modifications faites dans le dashboard seraient remplacées.
//
// Correspondance : projet par slug (titre sans accents) ; localité par nom. L'id de mockData
// est aussi l'id de la résidence dans Odoo (cf. src/data/odooResidences.js).
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const db = require('../src/models');
const { slugify } = require('../src/services/blogHtml');
const { ensureCatalogSchema } = require('../src/services/catalogSchema');

const STATUS = { 'EN COURS': 'en_cours', FINIS: 'livre' };
// Images « mobile » dont le nom de fichier diffère du slug.
const MOBILE_IMAGE_FILE = { 'bab-ezzouar': 'beb-ezzouar' };

const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, sep, c) => sep + c.toUpperCase());
const detail = (p, re) => (p.details || []).find((d) => re.test(d.label))?.value;
const isEmpty = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);

function percent(value) {
  const m = String(value || '').match(/(\d{1,3})\s*%/);
  return m ? Math.min(Number(m[1]), 100) : null;
}

/** Champs à écrire : tous avec --overwrite, sinon seulement ceux encore vides en base. */
function patchFor(row, wanted, overwrite) {
  if (!row || overwrite) return wanted;
  const patch = {};
  for (const [k, v] of Object.entries(wanted)) {
    if (isEmpty(row[k]) && !isEmpty(v)) patch[k] = v;
  }
  return patch;
}

async function importLocalities(list, { dryRun, overwrite }) {
  const existing = dryRun ? [] : await db.Locality.findAll();
  const byName = new Map();
  let created = 0;
  let updated = 0;
  for (const [i, loc] of list.entries()) {
    const short = loc.name.split(',')[0].trim();
    const slug = slugify(short);
    const wanted = {
      name: titleCase(short),
      city: titleCase(loc.name.split(',')[1]?.trim() || 'Alger'),
      slug,
      description: loc.description || null,
      imageUrl: loc.heroImage || loc.image || null,
      iconImage: loc.image || null,
      mobileImageUrl: `/assets/locality-mobile/${MOBILE_IMAGE_FILE[slug] || slug}-mobile.webp`,
      published: true,
      sortOrder: i,
    };
    let row = existing.find((r) => r.slug === slug || norm(r.name) === norm(short));
    if (dryRun) {
      console.log(`  localité ${slug}`);
    } else if (!row) {
      row = await db.Locality.create(wanted);
      created += 1;
    } else {
      // Le slug est toujours renseigné (nécessaire aux pages du site).
      const patch = { ...patchFor(row, wanted, overwrite), ...(row.slug ? {} : { slug }) };
      if (Object.keys(patch).length) {
        await row.update(patch);
        updated += 1;
      }
    }
    // Traductions EN / AR (nom + description) : créées si absentes, remplacées avec --overwrite.
    if (!dryRun && row && loc.translations) {
      for (const locale of ['en', 'ar']) {
        const t = loc.translations[locale];
        if (!t) continue;
        const current = await db.LocalityTranslation.findOne({ where: { localityId: row.id, locale } });
        const values = { name: t.name || null, description: t.description || null, machineTranslated: true };
        if (!current) await db.LocalityTranslation.create({ localityId: row.id, locale, ...values });
        else if (overwrite) await current.update(values);
      }
    }
    byName.set(norm(short), row);
  }
  console.log(`Localités : ${created} créée(s), ${updated} mise(s) à jour, ${list.length - created - updated} inchangée(s).`);
  return byName;
}

function localityIdFor(location, byName) {
  const wanted = norm(String(location || '').split(',')[0]);
  for (const [name, row] of byName) if (row && name === wanted) return row.id;
  for (const [name, row] of byName) if (row && norm(location).includes(name)) return row.id;
  return null;
}

async function importProjects(list, byName, { dryRun, overwrite }) {
  let created = 0;
  let updated = 0;
  for (const [i, p] of list.entries()) {
    const slug = slugify(p.title);
    const wanted = {
      title: p.title,
      status: STATUS[p.status] || 'en_cours',
      type: 'residentiel',
      address: p.location || null,
      latitude: p.lat ?? null,
      longitude: p.lng ?? null,
      features: Array.isArray(p.features) ? p.features : [],
      shortDescription: p.description ? p.description.slice(0, 280) : null,
      description: p.fullDescription || p.description || null,
      progressPercent: percent(detail(p, /avancement/i)),
      localityId: localityIdFor(p.location, byName),
      cardImage: p.image || null,
      coverImage: p.coverImage || p.image || null,
      isNightMode: Boolean(p.isNightMode),
      published: true,
      sortOrder: i,
      blocks: detail(p, /^blocs$/i) || null,
      typology: detail(p, /typologie/i) || null,
      plans: Array.isArray(p.plans) ? p.plans.map(({ type, area, rooms }) => ({ type, area: area || '', ...(rooms ? { rooms } : {}) })) : [],
      mapEmbedUrl: p.mapEmbedUrl || null,
      mapLinkUrl: p.mapLinkUrl || null,
      virtualTourUrl: p.virtualTourUrl || null,
      odooResidenceId: p.id,
    };
    const gallery = (p.gallery || []).filter(Boolean);

    if (dryRun) {
      console.log(`  projet ${slug} [${wanted.status}] avancement=${wanted.progressPercent ?? '-'} galerie=${gallery.length} localité=${wanted.localityId ?? '?'}`);
      continue;
    }

    const row = await db.Project.findOne({ where: { slug } })
      || (await db.Project.findAll()).find((r) => norm(r.title) === norm(p.title));

    await db.sequelize.transaction(async (transaction) => {
      let target = row;
      if (!target) {
        target = await db.Project.create({ ...wanted, slug }, { transaction });
        created += 1;
      } else {
        const patch = patchFor(target, wanted, overwrite);
        if (Object.keys(patch).length) {
          await target.update(patch, { transaction });
          updated += 1;
        }
      }
      // Photos : remplacées si --overwrite ou si le projet n'en a aucune au format du site.
      const images = await db.ProjectImage.findAll({ where: { projectId: target.id }, transaction });
      const hasSiteImages = images.some((img) => img.url.startsWith('/'));
      if (overwrite || !hasSiteImages) {
        await db.ProjectImage.destroy({ where: { projectId: target.id }, transaction });
        const rows = [];
        if (wanted.coverImage) rows.push({ projectId: target.id, url: wanted.coverImage, isCover: true, sortOrder: 0 });
        gallery.forEach((url, n) => rows.push({ projectId: target.id, url, isCover: false, sortOrder: n + 1 }));
        if (rows.length) await db.ProjectImage.bulkCreate(rows, { transaction });
      }
    });
  }
  console.log(`Projets : ${created} créé(s), ${updated} mis à jour, ${list.length - created - updated} inchangé(s).`);
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage : node scripts/importCatalog.js <fichier.json> [--dry-run] [--overwrite]');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');
  const overwrite = process.argv.includes('--overwrite');
  const { projects, localities } = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  console.log(`${projects.length} projets, ${localities.length} localités${dryRun ? ' (simulation)' : overwrite ? ' (écrasement)' : ''}.`);

  if (!dryRun) {
    await db.sequelize.sync({ alter: false });
    await ensureCatalogSchema();
  }
  const byName = await importLocalities(localities, { dryRun, overwrite });
  await importProjects(projects, byName, { dryRun, overwrite });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.sequelize.close());
