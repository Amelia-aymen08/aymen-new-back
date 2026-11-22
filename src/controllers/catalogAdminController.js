'use strict';
// Back-office du catalogue (dashboard /admin/projets et /admin/localites du site Next.js).
const db = require('../models');
const catalog = require('../services/catalog');

const ORDER = [['sortOrder', 'ASC'], ['id', 'ASC']];

const fullProject = (id, transaction) => db.Project.findByPk(id, {
  include: [
    { model: db.ProjectTranslation, as: 'translations' },
    { model: db.ProjectImage, as: 'images' },
  ],
  transaction,
});

const fullLocality = (id, transaction) => db.Locality.findByPk(id, {
  include: [{ model: db.LocalityTranslation, as: 'translations' }],
  transaction,
});

function serverError(res, label, err) {
  console.error(`[admin/${label}]`, err);
  res.status(500).json({ message: 'Erreur serveur, réessayez.' });
}

// ---------------------------------------------------------------- projets

exports.listProjects = async (req, res) => {
  try {
    const rows = await db.Project.findAll({
      include: [
        { model: db.ProjectTranslation, as: 'translations', attributes: ['locale', 'shortDescription', 'description', 'machineTranslated'] },
        { model: db.Locality, as: 'locality', attributes: ['id', 'name'] },
      ],
      order: ORDER,
    });
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        status: r.status,
        address: r.address,
        progressPercent: r.progressPercent,
        cardImage: r.cardImage,
        published: r.published,
        sortOrder: r.sortOrder,
        odooResidenceId: r.odooResidenceId,
        locality: r.locality ? r.locality.name : null,
        locales: catalog.projectLocales(r),
        machineTranslated: (r.translations || []).filter((t) => t.machineTranslated).map((t) => t.locale),
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    serverError(res, 'projects', err);
  }
};

exports.getProject = async (req, res) => {
  try {
    const row = await fullProject(req.params.id);
    if (!row) return res.status(404).json({ message: 'Projet introuvable.' });
    res.json(catalog.projectAdmin(row));
  } catch (err) {
    serverError(res, 'project', err);
  }
};

exports.createProject = async (req, res) => {
  const { data, translations, gallery, errors } = catalog.readProjectPayload(req.body || {}, { creating: true });
  if (errors.length) return res.status(400).json({ message: errors.join(' '), errors });
  try {
    if (await db.Project.findOne({ where: { slug: data.slug } })) {
      return res.status(409).json({ message: `L'adresse /projet/${data.slug} est déjà utilisée par un autre projet.` });
    }
    const id = await db.sequelize.transaction(async (transaction) => {
      const row = await db.Project.create({ ...data, type: 'residentiel' }, { transaction });
      await catalog.saveTranslations(db.ProjectTranslation, 'projectId', row.id, translations, transaction);
      await catalog.saveImages(row.id, data.coverImage, gallery, transaction);
      return row.id;
    });
    catalog.notifySite(['projects', `project:${data.slug}`, 'localities']);
    res.status(201).json(catalog.projectAdmin(await fullProject(id)));
  } catch (err) {
    serverError(res, 'project:create', err);
  }
};

exports.updateProject = async (req, res) => {
  const { data, translations, gallery, errors } = catalog.readProjectPayload(req.body || {}, { creating: false });
  if (errors.length) return res.status(400).json({ message: errors.join(' '), errors });
  try {
    const row = await db.Project.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Projet introuvable.' });
    await db.sequelize.transaction(async (transaction) => {
      await row.update(data, { transaction });
      await catalog.saveTranslations(db.ProjectTranslation, 'projectId', row.id, translations, transaction);
      await catalog.saveImages(row.id, data.coverImage, gallery, transaction);
    });
    catalog.notifySite(['projects', `project:${row.slug}`, 'localities']);
    res.json(catalog.projectAdmin(await fullProject(row.id)));
  } catch (err) {
    serverError(res, 'project:update', err);
  }
};

exports.removeProject = async (req, res) => {
  try {
    const row = await db.Project.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Projet introuvable.' });
    const { slug } = row;
    await db.sequelize.transaction(async (transaction) => {
      await db.ProjectTranslation.destroy({ where: { projectId: row.id }, transaction });
      await db.ProjectImage.destroy({ where: { projectId: row.id }, transaction });
      if (db.MobileFavorite) await db.MobileFavorite.destroy({ where: { projectId: row.id }, transaction });
      await row.destroy({ transaction });
    });
    catalog.notifySite(['projects', `project:${slug}`, 'localities']);
    res.json({ ok: true });
  } catch (err) {
    serverError(res, 'project:delete', err);
  }
};

// ---------------------------------------------------------------- localités

exports.listLocalities = async (req, res) => {
  try {
    const rows = await db.Locality.findAll({
      include: [{ model: db.LocalityTranslation, as: 'translations' }],
      order: ORDER,
    });
    const counts = await db.Project.count({ group: ['localityId'] });
    const byId = Object.fromEntries(counts.map((c) => [c.localityId, Number(c.count)]));
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        city: r.city,
        iconImage: r.iconImage,
        published: r.published,
        sortOrder: r.sortOrder,
        projects: byId[r.id] || 0,
        locales: catalog.localityLocales(r),
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    serverError(res, 'localities', err);
  }
};

exports.getLocality = async (req, res) => {
  try {
    const row = await fullLocality(req.params.id);
    if (!row) return res.status(404).json({ message: 'Localité introuvable.' });
    res.json(catalog.localityAdmin(row));
  } catch (err) {
    serverError(res, 'locality', err);
  }
};

exports.createLocality = async (req, res) => {
  const { data, translations, errors } = catalog.readLocalityPayload(req.body || {}, { creating: true });
  if (errors.length) return res.status(400).json({ message: errors.join(' '), errors });
  try {
    if (await db.Locality.findOne({ where: { slug: data.slug } })) {
      return res.status(409).json({ message: `L'adresse /localite/${data.slug} est déjà utilisée.` });
    }
    const id = await db.sequelize.transaction(async (transaction) => {
      const row = await db.Locality.create(data, { transaction });
      await catalog.saveTranslations(db.LocalityTranslation, 'localityId', row.id, translations, transaction);
      return row.id;
    });
    catalog.notifySite(['localities', 'projects']);
    res.status(201).json(catalog.localityAdmin(await fullLocality(id)));
  } catch (err) {
    serverError(res, 'locality:create', err);
  }
};

exports.updateLocality = async (req, res) => {
  const { data, translations, errors } = catalog.readLocalityPayload(req.body || {}, { creating: false });
  if (errors.length) return res.status(400).json({ message: errors.join(' '), errors });
  try {
    const row = await db.Locality.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Localité introuvable.' });
    // Une localité importée sans adresse de page en reçoit une à la première modification.
    if (!row.slug) data.slug = catalog.slugify(data.name);
    await db.sequelize.transaction(async (transaction) => {
      await row.update(data, { transaction });
      await catalog.saveTranslations(db.LocalityTranslation, 'localityId', row.id, translations, transaction);
    });
    catalog.notifySite(['localities', 'projects']);
    res.json(catalog.localityAdmin(await fullLocality(row.id)));
  } catch (err) {
    serverError(res, 'locality:update', err);
  }
};

exports.removeLocality = async (req, res) => {
  try {
    const row = await db.Locality.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Localité introuvable.' });
    const used = await db.Project.count({ where: { localityId: row.id } });
    if (used) {
      return res.status(409).json({ message: `${used} projet(s) sont rattachés à cette localité : changez-les de localité ou masquez-la plutôt.` });
    }
    await db.sequelize.transaction(async (transaction) => {
      await db.LocalityTranslation.destroy({ where: { localityId: row.id }, transaction });
      await row.destroy({ transaction });
    });
    catalog.notifySite(['localities']);
    res.json({ ok: true });
  } catch (err) {
    serverError(res, 'locality:delete', err);
  }
};

/**
 * PATCH /api/admin/projects/:id : modification rapide depuis la liste
 * (avancement, statut, publié, ordre) sans renvoyer toute la fiche.
 */
exports.patchProject = async (req, res) => {
  const body = req.body || {};
  const patch = {};
  if ('progressPercent' in body) {
    const v = body.progressPercent === '' || body.progressPercent === null ? null : Number(body.progressPercent);
    if (v !== null && (!Number.isInteger(v) || v < 0 || v > 100)) {
      return res.status(400).json({ message: "L'avancement doit être un nombre entier entre 0 et 100." });
    }
    patch.progressPercent = v;
  }
  if ('published' in body) patch.published = Boolean(body.published);
  if ('status' in body) {
    if (!['en_cours', 'livre', 'bientot'].includes(body.status)) return res.status(400).json({ message: 'Statut invalide.' });
    patch.status = body.status;
  }
  if ('sortOrder' in body) {
    const v = Number(body.sortOrder);
    if (!Number.isInteger(v)) return res.status(400).json({ message: 'Ordre invalide.' });
    patch.sortOrder = v;
  }
  if (!Object.keys(patch).length) return res.status(400).json({ message: 'Rien à modifier.' });
  try {
    const row = await db.Project.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Projet introuvable.' });
    await row.update(patch);
    catalog.notifySite(['projects', `project:${row.slug}`, 'localities']);
    res.json({ id: row.id, ...patch, updatedAt: row.updatedAt });
  } catch (err) {
    serverError(res, 'project:patch', err);
  }
};
