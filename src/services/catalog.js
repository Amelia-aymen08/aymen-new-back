'use strict';
// Catalogue (projets / localités) : mise en forme pour le site, validation des formulaires
// du dashboard, revalidation du site Next.js, correspondance avec les résidences Odoo.
const db = require('../models');
const { slugify } = require('./blogHtml');

const LOCALES = ['fr', 'en', 'ar'];
const TRANSLATED = ['en', 'ar'];
const STATUSES = ['en_cours', 'livre', 'bientot'];

const FRONTEND_BASE = (process.env.FRONTEND_ASSET_BASE_URL || 'https://aymenpromotion-dz.com').replace(/\/$/, '');
const BACKEND_BASE = (process.env.BACKEND_PUBLIC_URL || 'https://backend.aymenpromotion-dz.com').replace(/\/$/, '');

const clean = (v, max) => {
  const s = String(v ?? '').trim();
  return max ? s.slice(0, max) : s;
};
const orNull = (v, max) => clean(v, max) || null;

/** URL absolue d'une image (application mobile) : /uploads/... -> backend, /assets/... -> site. */
function absoluteAssetUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/uploads/')) return `${BACKEND_BASE}${url}`;
  return `${FRONTEND_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Chemin d'image accepté : chemin du site (/assets/...), upload (/uploads/...) ou https://. */
function imagePath(v) {
  const s = clean(v, 500);
  if (!s) return null;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  return null;
}

function httpsUrl(v, max = 500) {
  const s = clean(v, max);
  return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : null;
}

/** Lien Google Maps « intégrer » : accepte l'URL seule ou tout le code <iframe> copié depuis Google. */
function mapEmbed(v) {
  let s = clean(v, 2000);
  const m = s.match(/src=["']([^"']+)["']/i);
  if (m) s = m[1];
  s = s.replace(/&amp;/g, '&');
  return /^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed\?[^\s"'<>]+$/i.test(s) && s.length <= 1000 ? s : null;
}

/** Prévient le site Next.js que des données ont changé (vide son cache). Sans effet si non configuré. */
function notifySite(tags) {
  const url = process.env.NEXT_REVALIDATE_URL;
  const secret = process.env.NEXT_REVALIDATE_SECRET;
  if (!url || !secret) return;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
    body: JSON.stringify({ tags }),
  }).catch((err) => console.warn('[catalogue] revalidation Next.js échouée :', err.message));
}

const hasText = (t) => Boolean(t && (clean(t.shortDescription) || clean(t.description)));

// ---------------------------------------------------------------- site (public)

function translationOf(row, locale) {
  if (locale === 'fr') return null;
  return (row.translations || []).find((t) => t.locale === locale) || null;
}

// Région affichée après la commune (« Hydra, Alger »).
const REGION_LABELS = { Alger: { en: 'Algiers', ar: 'الجزائر العاصمة' } };
const regionLabel = (region, locale) => (locale === 'fr' ? region : REGION_LABELS[region]?.[locale] || region);

/** Commune et localisation dans la langue : nom traduit de la localité rattachée, sinon texte saisi. */
function placeLabels(row, locale) {
  const [city = '', region = ''] = String(row.address || '').split(',').map((x) => x.trim());
  const localityName = row.locality ? clean(translationOf(row.locality, locale)?.name) || row.locality.name : '';
  const cityLabel = locale === 'fr' ? city || localityName : localityName || city;
  if (locale === 'fr') return { cityLabel, locationLabel: row.address || '' };
  const parts = [cityLabel, region ? regionLabel(region, locale) : ''].filter(Boolean);
  return { cityLabel, locationLabel: parts.join(locale === 'ar' ? '، ' : ', ') };
}

function projectLocales(row) {
  return ['fr', ...TRANSLATED.filter((l) => hasText(translationOf(row, l)))];
}

/** Projet pour les cartes / listes. Les textes absents dans la langue demandée retombent sur le français. */
function projectSummary(row, locale) {
  const t = translationOf(row, locale);
  const translated = hasText(t);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    location: row.address || '',
    ...placeLabels(row, locale),
    status: row.status,
    progressPercent: row.progressPercent,
    cardImage: row.cardImage,
    coverImage: row.coverImage,
    isNightMode: row.isNightMode,
    lat: row.latitude,
    lng: row.longitude,
    mapLinkUrl: row.mapLinkUrl,
    planTypes: (Array.isArray(row.plans) ? row.plans : []).map((p) => p?.type).filter(Boolean),
    locality: row.locality ? { id: row.locality.id, slug: row.locality.slug, name: row.locality.name } : null,
    shortDescription: (translated && clean(t.shortDescription)) || row.shortDescription || '',
    contentLocale: translated ? locale : 'fr',
    locales: projectLocales(row),
    updatedAt: row.updatedAt,
  };
}

function projectDetail(row, locale) {
  const t = translationOf(row, locale);
  const translated = hasText(t);
  const images = [...(row.images || [])].sort((a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id));
  return {
    ...projectSummary(row, locale),
    description: (translated && clean(t.description)) || row.description || '',
    typology: (translated && clean(t.typology)) || row.typology || '',
    metaTitle: (translated && clean(t.metaTitle)) || (translated ? '' : row.metaTitle || ''),
    metaDescription: (translated && clean(t.metaDescription)) || (translated ? '' : row.metaDescription || ''),
    blocks: row.blocks || '',
    features: Array.isArray(row.features) ? row.features : [],
    plans: Array.isArray(row.plans) ? row.plans : [],
    gallery: images.filter((i) => !i.isCover).map((i) => i.url),
    mapEmbedUrl: row.mapEmbedUrl,
    virtualTourUrl: row.virtualTourUrl,
  };
}

function localityLocales(row) {
  return ['fr', ...TRANSLATED.filter((l) => clean(translationOf(row, l)?.description))];
}

function localityPublic(row, locale) {
  const t = translationOf(row, locale);
  const translated = Boolean(clean(t?.description));
  return {
    id: row.id,
    slug: row.slug,
    name: clean(t?.name) || row.name,
    city: regionLabel(row.city, locale),
    description: translated ? clean(t.description) : row.description || '',
    iconImage: row.iconImage,
    heroImage: row.imageUrl,
    mobileImage: row.mobileImageUrl,
    contentLocale: translated ? locale : 'fr',
    locales: localityLocales(row),
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------- dashboard (admin)

function projectAdmin(row) {
  const translations = {};
  for (const t of row.translations || []) {
    translations[t.locale] = {
      shortDescription: t.shortDescription || '',
      description: t.description || '',
      typology: t.typology || '',
      metaTitle: t.metaTitle || '',
      metaDescription: t.metaDescription || '',
      machineTranslated: t.machineTranslated,
      updatedAt: t.updatedAt,
    };
  }
  const images = [...(row.images || [])].sort((a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id));
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    address: row.address || '',
    localityId: row.localityId,
    latitude: row.latitude,
    longitude: row.longitude,
    progressPercent: row.progressPercent,
    cardImage: row.cardImage || '',
    coverImage: row.coverImage || '',
    isNightMode: row.isNightMode,
    published: row.published,
    sortOrder: row.sortOrder,
    blocks: row.blocks || '',
    typology: row.typology || '',
    features: Array.isArray(row.features) ? row.features : [],
    plans: Array.isArray(row.plans) ? row.plans : [],
    gallery: images.filter((i) => !i.isCover).map((i) => i.url),
    mapEmbedUrl: row.mapEmbedUrl || '',
    mapLinkUrl: row.mapLinkUrl || '',
    virtualTourUrl: row.virtualTourUrl || '',
    odooResidenceId: row.odooResidenceId,
    shortDescription: row.shortDescription || '',
    description: row.description || '',
    metaTitle: row.metaTitle || '',
    metaDescription: row.metaDescription || '',
    translations,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function localityAdmin(row) {
  const translations = {};
  for (const t of row.translations || []) {
    translations[t.locale] = { name: t.name || '', description: t.description || '', machineTranslated: t.machineTranslated, updatedAt: t.updatedAt };
  }
  return {
    id: row.id,
    slug: row.slug || '',
    name: row.name,
    city: row.city,
    description: row.description || '',
    imageUrl: row.imageUrl || '',
    iconImage: row.iconImage || '',
    mobileImageUrl: row.mobileImageUrl || '',
    published: row.published,
    sortOrder: row.sortOrder,
    translations,
    updatedAt: row.updatedAt,
  };
}

const num = (v, { min, max, int } = {}) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) return undefined;
  if ((min !== undefined && n < min) || (max !== undefined && n > max)) return undefined;
  return int ? Math.round(n) : n;
};

function readPlans(list, errors) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 30).map((p, i) => {
    const type = clean(p?.type, 60);
    if (!type) errors.push(`Plan n°${i + 1} : type manquant (ex. F3).`);
    const rooms = Array.isArray(p?.rooms)
      ? p.rooms.slice(0, 40).map((r) => ({ name: clean(r?.name, 80), area: clean(r?.area, 40) })).filter((r) => r.name)
      : [];
    return { type, area: clean(p?.area, 80), ...(rooms.length ? { rooms } : {}) };
  }).filter((p) => p.type);
}

/** Valide le formulaire projet du dashboard. Retourne { data, translations, gallery, errors }. */
function readProjectPayload(body, { creating }) {
  const errors = [];
  const title = clean(body.title, 120);
  if (!title) errors.push('Le nom du projet est obligatoire.');

  const data = {
    title,
    status: STATUSES.includes(body.status) ? body.status : 'en_cours',
    address: orNull(body.address, 255),
    localityId: num(body.localityId, { min: 1, int: true }) ?? null,
    blocks: orNull(body.blocks, 20),
    typology: orNull(body.typology, 120),
    features: Array.isArray(body.features) ? [...new Set(body.features.map((f) => clean(f, 60)).filter(Boolean))].slice(0, 40) : [],
    plans: readPlans(body.plans, errors),
    cardImage: imagePath(body.cardImage),
    coverImage: imagePath(body.coverImage),
    isNightMode: Boolean(body.isNightMode),
    published: body.published !== false,
    mapLinkUrl: httpsUrl(body.mapLinkUrl),
    virtualTourUrl: httpsUrl(body.virtualTourUrl),
    shortDescription: orNull(body.shortDescription, 280),
    description: orNull(body.description, 20000),
    metaTitle: orNull(body.metaTitle, 300),
    metaDescription: orNull(body.metaDescription, 500),
  };

  const progress = num(body.progressPercent, { min: 0, max: 100, int: true });
  if (progress === undefined) errors.push("L'avancement doit être un nombre entre 0 et 100.");
  else data.progressPercent = progress;

  const lat = num(body.latitude, { min: -90, max: 90 });
  const lng = num(body.longitude, { min: -180, max: 180 });
  if (lat === undefined || lng === undefined) errors.push('Coordonnées GPS invalides.');
  else Object.assign(data, { latitude: lat, longitude: lng });

  const sortOrder = num(body.sortOrder, { min: -9999, max: 9999, int: true });
  data.sortOrder = sortOrder ?? 0;

  const odoo = num(body.odooResidenceId, { min: 1, max: 999999, int: true });
  if (odoo === undefined) errors.push('ID résidence Odoo invalide.');
  else data.odooResidenceId = odoo;

  if (body.mapEmbedUrl && clean(body.mapEmbedUrl)) {
    data.mapEmbedUrl = mapEmbed(body.mapEmbedUrl);
    if (!data.mapEmbedUrl) errors.push('Carte Google Maps : collez le lien « Intégrer une carte » (ou tout le code <iframe>).');
  } else {
    data.mapEmbedUrl = null;
  }
  if (clean(body.cardImage) && !data.cardImage) errors.push('Vignette : chemin d’image invalide.');
  if (clean(body.coverImage) && !data.coverImage) errors.push('Image de couverture : chemin d’image invalide.');
  if (clean(body.virtualTourUrl) && !data.virtualTourUrl) errors.push('Visite virtuelle : lien https:// attendu.');
  if (clean(body.mapLinkUrl) && !data.mapLinkUrl) errors.push('Lien Google Maps : lien https:// attendu.');

  if (creating) {
    data.slug = slugify(body.slug || title);
    if (!data.slug) errors.push("Adresse de la page (slug) invalide.");
  }

  const gallery = Array.isArray(body.gallery) ? body.gallery.map(imagePath).filter(Boolean).slice(0, 80) : [];

  const translations = {};
  for (const l of TRANSLATED) {
    const t = body?.translations?.[l];
    if (!t) continue;
    const row = {
      shortDescription: orNull(t.shortDescription, 400),
      description: orNull(t.description, 20000),
      typology: orNull(t.typology, 120),
      metaTitle: orNull(t.metaTitle, 300),
      metaDescription: orNull(t.metaDescription, 500),
      machineTranslated: Boolean(t.machineTranslated),
    };
    translations[l] = Object.values(row).some((v) => typeof v === 'string') ? row : null;
  }

  return { data, translations, gallery, errors };
}

function readLocalityPayload(body, { creating }) {
  const errors = [];
  const name = clean(body.name, 120);
  if (!name) errors.push('Le nom de la localité est obligatoire.');
  const data = {
    name,
    city: clean(body.city, 120) || 'Alger',
    description: orNull(body.description, 10000),
    imageUrl: imagePath(body.imageUrl),
    iconImage: imagePath(body.iconImage),
    mobileImageUrl: imagePath(body.mobileImageUrl),
    published: body.published !== false,
    sortOrder: num(body.sortOrder, { min: -9999, max: 9999, int: true }) ?? 0,
  };
  if (creating) {
    data.slug = slugify(body.slug || name);
    if (!data.slug) errors.push('Adresse de la page (slug) invalide.');
  }
  const translations = {};
  for (const l of TRANSLATED) {
    const t = body?.translations?.[l];
    if (!t) continue;
    const description = orNull(t.description, 10000);
    const tName = orNull(t.name, 120);
    translations[l] = description || tName ? { name: tName, description, machineTranslated: Boolean(t.machineTranslated) } : null;
  }
  return { data, translations, errors };
}

/** Écrit / supprime les traductions EN / AR d'un projet ou d'une localité. */
async function saveTranslations(Model, foreignKey, id, translations, transaction) {
  for (const [locale, t] of Object.entries(translations)) {
    const where = { [foreignKey]: id, locale };
    if (!t) {
      await Model.destroy({ where, transaction });
      continue;
    }
    const existing = await Model.findOne({ where, transaction });
    if (existing) await existing.update(t, { transaction });
    else await Model.create({ ...where, ...t }, { transaction });
  }
}

/** Remplace les photos d'un projet : couverture (isCover, utilisée par l'appli mobile) + galerie ordonnée. */
async function saveImages(projectId, coverImage, gallery, transaction) {
  await db.ProjectImage.destroy({ where: { projectId }, transaction });
  const rows = [];
  if (coverImage) rows.push({ projectId, url: coverImage, isCover: true, sortOrder: 0 });
  gallery.forEach((url, i) => rows.push({ projectId, url, isCover: false, sortOrder: i + 1 }));
  if (rows.length) await db.ProjectImage.bulkCreate(rows, { transaction });
}

// ---------------------------------------------------------------- Odoo

const normalizeName = (v) => String(v || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/^\s*RESIDENCE\s+/, '').replace(/\s+/g, ' ').trim();

/** Id Odoo de la résidence d'un devis (« CÉLESTINE », « Résidence Célestine »…), lu dans le dashboard. */
async function odooResidenceIdFor(sourceProject) {
  const wanted = normalizeName(sourceProject);
  if (!wanted || !db.Project) return '';
  try {
    const rows = await db.Project.findAll({ attributes: ['title', 'slug', 'odooResidenceId'] });
    const hit = rows.find((r) => r.odooResidenceId && (normalizeName(r.title) === wanted || r.slug === slugify(wanted)));
    return hit ? String(hit.odooResidenceId) : '';
  } catch {
    return '';
  }
}

module.exports = {
  LOCALES,
  TRANSLATED,
  absoluteAssetUrl,
  notifySite,
  projectSummary,
  projectDetail,
  projectLocales,
  localityPublic,
  localityLocales,
  projectAdmin,
  localityAdmin,
  readProjectPayload,
  readLocalityPayload,
  saveTranslations,
  saveImages,
  odooResidenceIdFor,
  slugify,
};
