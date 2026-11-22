'use strict';
// API publique du catalogue pour le site Next.js (lecture seule, éléments publiés uniquement).
//   GET /api/site/projects?lang=fr            -> { items: [...] }
//   GET /api/site/projects/:slug?lang=en       -> projet détaillé (404 si inconnu ou masqué)
//   GET /api/site/localities?lang=ar           -> { items: [...] }
//   GET /api/site/localities/:slug?lang=fr     -> localité + ses projets
//   GET /api/site/catalog-index                -> slugs + langues disponibles (sitemap, pré-rendu)
const db = require('../models');
const catalog = require('../services/catalog');

const langOf = (req) => (catalog.LOCALES.includes(req.query.lang) ? req.query.lang : 'fr');
const ORDER = [['sortOrder', 'ASC'], ['id', 'ASC']];

const projectIncludes = (withImages) => [
  { model: db.ProjectTranslation, as: 'translations' },
  {
    model: db.Locality,
    as: 'locality',
    attributes: ['id', 'slug', 'name'],
    include: [{ model: db.LocalityTranslation, as: 'translations', attributes: ['locale', 'name'] }],
  },
  ...(withImages ? [{ model: db.ProjectImage, as: 'images' }] : []),
];

function fail(res, label, err) {
  console.error(`[site/${label}]`, err.message);
  res.status(500).json({ message: 'Catalogue momentanément indisponible.' });
}

exports.listProjects = async (req, res) => {
  try {
    const rows = await db.Project.findAll({ where: { published: true }, include: projectIncludes(false), order: ORDER });
    res.json({ items: rows.map((r) => catalog.projectSummary(r, langOf(req))) });
  } catch (err) {
    fail(res, 'projects', err);
  }
};

exports.getProject = async (req, res) => {
  try {
    const row = await db.Project.findOne({
      where: { slug: String(req.params.slug || '').toLowerCase(), published: true },
      include: projectIncludes(true),
    });
    if (!row) return res.status(404).json({ message: 'Projet introuvable.' });
    res.json(catalog.projectDetail(row, langOf(req)));
  } catch (err) {
    fail(res, 'project', err);
  }
};

exports.listLocalities = async (req, res) => {
  try {
    const rows = await db.Locality.findAll({
      where: { published: true },
      include: [{ model: db.LocalityTranslation, as: 'translations' }],
      order: ORDER,
    });
    res.json({ items: rows.filter((r) => r.slug).map((r) => catalog.localityPublic(r, langOf(req))) });
  } catch (err) {
    fail(res, 'localities', err);
  }
};

exports.getLocality = async (req, res) => {
  try {
    const lang = langOf(req);
    const row = await db.Locality.findOne({
      where: { slug: String(req.params.slug || '').toLowerCase(), published: true },
      include: [{ model: db.LocalityTranslation, as: 'translations' }],
    });
    if (!row) return res.status(404).json({ message: 'Localité introuvable.' });
    const projects = await db.Project.findAll({
      where: { localityId: row.id, published: true },
      include: projectIncludes(false),
      order: ORDER,
    });
    res.json({ ...catalog.localityPublic(row, lang), projects: projects.map((p) => catalog.projectSummary(p, lang)) });
  } catch (err) {
    fail(res, 'locality', err);
  }
};

exports.index = async (req, res) => {
  try {
    const [projects, localities] = await Promise.all([
      db.Project.findAll({
        where: { published: true },
        attributes: ['id', 'slug', 'updatedAt'],
        include: [{ model: db.ProjectTranslation, as: 'translations' }],
        order: ORDER,
      }),
      db.Locality.findAll({
        where: { published: true },
        attributes: ['id', 'slug', 'updatedAt'],
        include: [{ model: db.LocalityTranslation, as: 'translations' }],
        order: ORDER,
      }),
    ]);
    res.json({
      projects: projects.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt, locales: catalog.projectLocales(p) })),
      localities: localities
        .filter((l) => l.slug)
        .map((l) => ({ slug: l.slug, updatedAt: l.updatedAt, locales: catalog.localityLocales(l) })),
    });
  } catch (err) {
    fail(res, 'catalog-index', err);
  }
};
