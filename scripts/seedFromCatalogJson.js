// Seed additif du catalogue MySQL à partir de data/seed_catalog.json
// (extrait de frontend/src/data/mockData.ts, la vraie source du catalogue
// affiché sur le site — cf. docs/decisions.md D14). Idempotent : un projet
// déjà présent (même slug) est ignoré, jamais modifié ni dupliqué. Aucune
// suppression, aucun DROP, conforme au cahier §7.3.
//
// Usage (une seule fois, en production comme en local) :
//   node scripts/seedFromCatalogJson.js
//
// Variable optionnelle FRONTEND_ASSET_BASE_URL pour changer l'hôte des
// images si le site n'est plus servi depuis https://aymenpromotion-dz.com.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/models');
const { Project, ProjectImage, Locality } = db;

const CATALOG_PATH = path.join(__dirname, '..', 'data', 'seed_catalog.json');
const ASSET_BASE = process.env.FRONTEND_ASSET_BASE_URL || 'https://aymenpromotion-dz.com';

const STATUS_MAP = {
  'EN COURS': 'en_cours',
  FINIS: 'livre',
};

function slugify(title) {
  return title
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toAssetUrl(relativePath) {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  return `${ASSET_BASE}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
}

function splitLocalityName(rawName) {
  const parts = rawName.split(',').map((p) => p.trim()).filter(Boolean);
  return { name: parts[0] || rawName, city: parts[1] || parts[0] || rawName };
}

async function seedLocalities(localities) {
  const byRawName = new Map();
  let created = 0;

  for (const loc of localities) {
    const { name, city } = splitLocalityName(loc.name);
    const [row, wasCreated] = await Locality.findOrCreate({
      where: { name },
      defaults: {
        name,
        city,
        description: loc.description || null,
        imageUrl: toAssetUrl(loc.heroImage || loc.image),
      },
    });
    byRawName.set(loc.name.toLowerCase(), row);
    if (wasCreated) created += 1;
  }

  console.log(`Localités : ${created} créées, ${localities.length - created} déjà présentes.`);
  return byRawName;
}

function matchLocalityId(location, localitiesByRawName) {
  if (!location) return null;
  const lower = location.toLowerCase();
  for (const [rawName, row] of localitiesByRawName.entries()) {
    const shortName = rawName.split(',')[0].trim();
    if (shortName && lower.includes(shortName)) return row.id;
  }
  return null;
}

async function seedProjects(projects, localitiesByRawName) {
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const project of projects) {
    const slug = slugify(project.title);
    try {
      const existing = await Project.findOne({ where: { slug } });
      if (existing) {
        skipped += 1;
        continue;
      }

      await db.sequelize.transaction(async (t) => {
        const row = await Project.create(
          {
            title: project.title,
            slug,
            description: project.fullDescription || project.description || null,
            status: STATUS_MAP[project.status] || 'en_cours',
            type: 'residentiel',
            address: project.location || null,
            latitude: project.lat ?? null,
            longitude: project.lng ?? null,
            features: Array.isArray(project.features) ? project.features : [],
            deliveryDate: null,
            localityId: matchLocalityId(project.location, localitiesByRawName),
          },
          { transaction: t }
        );

        const coverUrl = toAssetUrl(project.coverImage || project.image);
        const galleryUrls = Array.isArray(project.gallery) ? project.gallery.map(toAssetUrl) : [];
        const seen = new Set();
        const images = [];

        if (coverUrl && !seen.has(coverUrl)) {
          seen.add(coverUrl);
          images.push({ projectId: row.id, url: coverUrl, isCover: true });
        }
        for (const url of galleryUrls) {
          if (!url || seen.has(url)) continue;
          seen.add(url);
          images.push({ projectId: row.id, url, isCover: false });
        }

        if (images.length) {
          await ProjectImage.bulkCreate(images, { transaction: t });
        }
      });

      created += 1;
    } catch (err) {
      failed += 1;
      console.error(`Échec sur le projet "${project.title}" (slug=${slug}):`, err.message);
    }
  }

  console.log(`Projets : ${created} créés, ${skipped} déjà présents, ${failed} échoués.`);
}

async function main() {
  if (!fs.existsSync(CATALOG_PATH)) {
    console.error(`Fichier introuvable : ${CATALOG_PATH}`);
    console.error('Générez-le localement avec: node --experimental-strip-types scripts/extractMockData.mjs');
    process.exit(1);
  }

  const { projects, localities } = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  console.log(`Chargé ${projects.length} projets et ${localities.length} localités depuis ${CATALOG_PATH}`);
  console.log(`Images préfixées avec : ${ASSET_BASE}`);

  const localitiesByRawName = await seedLocalities(localities);
  await seedProjects(projects, localitiesByRawName);

  await db.sequelize.close();
}

main().catch((err) => {
  console.error('Échec du seed :', err);
  process.exit(1);
});
