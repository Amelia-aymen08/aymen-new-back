const { Op } = require('sequelize');
const db = require('../../models');
const { Project, ProjectImage, Locality } = db;

const SUPPORTED_LOCALES = ['fr', 'ar', 'en', 'es'];

exports.bootstrap = async (req, res) => {
  res.json({
    data: {
      languages: SUPPORTED_LOCALES,
      minVersion: { android: '1.0.0', ios: '1.0.0' },
      flags: {
        smartMatch: false,
        compare: false,
        simulator: false,
        virtualTours: false,
        pushNotifications: false,
      },
      support: {
        phone: process.env.MOBILE_SUPPORT_PHONE || '+213555000000',
        whatsapp: process.env.MOBILE_SUPPORT_WHATSAPP || '+213555000000',
        email: process.env.MAIL_FROM || 'contact@aymenpromotion.com',
      },
    },
    meta: { generatedAt: new Date().toISOString() },
    request_id: req.headers['x-request-id'] || null,
  });
};

function mapProjectSummary(project) {
  const plain = project.toJSON ? project.toJSON() : project;
  return {
    id: String(plain.id),
    slug: plain.slug,
    title: plain.title,
    status: plain.status,
    type: plain.type,
    address: plain.address,
    coverImage: resolveCoverImage(plain),
    description: plain.shortDescription || truncate(plain.description, 140),
    // Avancement réel uniquement (cahier §8.3) : absent plutôt qu'inventé
    // quand aucune valeur chiffrée n'existe pour ce projet.
    progressPercent: plain.progressPercent ?? null,
    locality: plain.locality ? { id: String(plain.locality.id), name: plain.locality.name } : null,
    deliveryDate: plain.deliveryDate,
    price: { visibility: 'hidden', amount: null, currency: 'DZD', label: 'Sur demande' },
  };
}

function truncate(text, maxLength) {
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

// `coverImage` n'est pas déclaré comme colonne sur le modèle Project
// (docs/audit_backend.md §2) : l'image de couverture est dérivée de la
// relation ProjectImage (isCover=true), avec repli sur la première image
// puis sur un éventuel champ `coverImage` si une évolution future l'ajoute.
function resolveCoverImage(plain) {
  if (Array.isArray(plain.images) && plain.images.length) {
    const cover = plain.images.find((img) => img.isCover) || plain.images[0];
    if (cover?.url) return cover.url;
  }
  return plain.coverImage || null;
}

function mapProjectDetail(project, similar) {
  const plain = project.toJSON ? project.toJSON() : project;
  const images = Array.isArray(plain.images) ? plain.images.map((img) => img.url) : [];
  return {
    ...mapProjectSummary(project),
    description: plain.description || null,
    latitude: plain.latitude,
    longitude: plain.longitude,
    features: Array.isArray(plain.features) ? plain.features : [],
    gallery: images,
    availability: {
      status: plain.status,
      asOf: plain.updatedAt,
      isRealtime: false,
    },
    similarProjects: similar.map(mapProjectSummary),
    updatedAt: plain.updatedAt,
  };
}

exports.home = async (req, res) => {
  try {
    const latestProjects = await Project.findAll({
      include: ['locality', 'images'],
      order: [['createdAt', 'DESC']],
      limit: 5,
    });
    const localities = await Locality.findAll({ limit: 8 });

    res.json({
      data: {
        hero: latestProjects[0] ? mapProjectSummary(latestProjects[0]) : null,
        latestProjects: latestProjects.map(mapProjectSummary),
        localities: localities.map((l) => ({ id: String(l.id), name: l.name, city: l.city, imageUrl: l.imageUrl })),
      },
      meta: { generatedAt: new Date().toISOString() },
      request_id: req.headers['x-request-id'] || null,
    });
  } catch (err) {
    console.error('[mobile/home]', err);
    res.status(500).json({ error: { code: 'HOME_UNAVAILABLE', message: 'Accueil momentanément indisponible.', retryable: true } });
  }
};

exports.listProjects = async (req, res) => {
  try {
    const { status, type, localityId, search, limit } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (localityId) where.localityId = localityId;
    if (search) where.title = { [Op.like]: `%${search}%` };

    const take = Math.min(Number(limit) || 20, 50);
    const projects = await Project.findAll({
      where,
      include: ['locality', 'images'],
      order: [['createdAt', 'DESC']],
      limit: take,
    });

    res.json({
      data: projects.map(mapProjectSummary),
      meta: { count: projects.length, limit: take },
      request_id: req.headers['x-request-id'] || null,
    });
  } catch (err) {
    console.error('[mobile/projects]', err);
    res.status(500).json({ error: { code: 'PROJECTS_UNAVAILABLE', message: 'Catalogue momentanément indisponible.', retryable: true } });
  }
};

exports.getProject = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, { include: ['locality', 'images'] });
    if (!project) {
      return res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Projet introuvable.', retryable: false } });
    }

    const similarWhere = {
      id: { [Op.ne]: project.id },
      [Op.or]: [{ localityId: project.localityId }, { type: project.type }],
    };
    const similar = await Project.findAll({ where: similarWhere, include: ['locality'], limit: 4 });

    res.json({
      data: mapProjectDetail(project, similar),
      request_id: req.headers['x-request-id'] || null,
    });
  } catch (err) {
    console.error('[mobile/project]', err);
    res.status(500).json({ error: { code: 'PROJECT_UNAVAILABLE', message: 'Fiche momentanément indisponible.', retryable: true } });
  }
};

exports.projectsMap = async (req, res) => {
  try {
    const projects = await Project.findAll({
      where: { latitude: { [Op.ne]: null }, longitude: { [Op.ne]: null } },
      attributes: ['id', 'title', 'slug', 'status', 'latitude', 'longitude'],
    });
    res.json({
      data: projects.map((p) => ({
        id: String(p.id),
        title: p.title,
        slug: p.slug,
        status: p.status,
        latitude: p.latitude,
        longitude: p.longitude,
      })),
      request_id: req.headers['x-request-id'] || null,
    });
  } catch (err) {
    console.error('[mobile/projects/map]', err);
    res.status(500).json({ error: { code: 'MAP_UNAVAILABLE', message: 'Carte momentanément indisponible.', retryable: true } });
  }
};

exports.listLocalities = async (req, res) => {
  try {
    const localities = await Locality.findAll();
    res.json({
      data: localities.map((l) => ({ id: String(l.id), name: l.name, city: l.city, description: l.description, imageUrl: l.imageUrl })),
      request_id: req.headers['x-request-id'] || null,
    });
  } catch (err) {
    console.error('[mobile/localities]', err);
    res.status(500).json({ error: { code: 'LOCALITIES_UNAVAILABLE', message: 'Localités momentanément indisponibles.', retryable: true } });
  }
};

exports.getLocality = async (req, res) => {
  try {
    const locality = await Locality.findByPk(req.params.id, { include: [{ association: 'projects' }] });
    if (!locality) {
      return res.status(404).json({ error: { code: 'LOCALITY_NOT_FOUND', message: 'Localité introuvable.', retryable: false } });
    }
    res.json({
      data: {
        id: String(locality.id),
        name: locality.name,
        city: locality.city,
        description: locality.description,
        imageUrl: locality.imageUrl,
        projects: (locality.projects || []).map(mapProjectSummary),
      },
      request_id: req.headers['x-request-id'] || null,
    });
  } catch (err) {
    console.error('[mobile/locality]', err);
    res.status(500).json({ error: { code: 'LOCALITY_UNAVAILABLE', message: 'Localité momentanément indisponible.', retryable: true } });
  }
};

exports.contactOptions = async (req, res) => {
  res.json({
    data: {
      phone: process.env.MOBILE_SUPPORT_PHONE || '+213555000000',
      whatsapp: process.env.MOBILE_SUPPORT_WHATSAPP || '+213555000000',
      email: process.env.MAIL_FROM || 'contact@aymenpromotion.com',
      hours: 'Dimanche–Jeudi, 9h–17h (Afrique/Alger)',
    },
    request_id: req.headers['x-request-id'] || null,
  });
};

module.exports.mapProjectSummary = mapProjectSummary;
