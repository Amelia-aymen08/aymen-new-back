'use strict';
// Back-office du blog (dashboard /admin/blog du site Next.js).
const db = require('../models');
const { sanitizeArticleHtml, stripHtml, slugify } = require('../services/blogHtml');
const { translateFields, providerName } = require('../services/translator');

const LOCALES = ['fr', 'en', 'ar'];
const CATEGORIES = ['evenement', 'amenagement-decoration', 'investissement', 'achat-vente', 'style-de-vie', 'gestion-copropriete'];

const clean = (v, max) => {
  const s = String(v ?? '').trim();
  return max ? s.slice(0, max) : s;
};

function serializeAdmin(post) {
  const translations = {};
  for (const t of post.translations || []) {
    translations[t.locale] = {
      title: t.title,
      excerpt: t.excerpt || '',
      contentHtml: t.contentHtml || '',
      metaTitle: t.metaTitle || '',
      metaDescription: t.metaDescription || '',
      machineTranslated: t.machineTranslated,
      updatedAt: t.updatedAt,
    };
  }
  return {
    id: post.id,
    slug: post.slug,
    status: post.status,
    category: post.category,
    coverImage: post.coverImage,
    author: post.author,
    publishedAt: post.publishedAt,
    legacySource: post.legacySource,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    translations,
  };
}

/** Prévient le site Next.js qu'un article a changé (vide son cache). Sans effet si non configuré. */
function notifySite(slug) {
  const url = process.env.NEXT_REVALIDATE_URL;
  const secret = process.env.NEXT_REVALIDATE_SECRET;
  if (!url || !secret) return;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
    body: JSON.stringify({ tags: ['blog', `blog:${slug}`] }),
  }).catch((err) => console.warn('[blog] revalidation Next.js échouée :', err.message));
}

/** Valide et normalise le corps envoyé par le dashboard. */
function readPayload(body) {
  const errors = [];
  const fr = body?.translations?.fr || {};
  const slug = slugify(body.slug || fr.title);
  if (!slug) errors.push('Le titre français (ou le slug) est obligatoire.');

  const category = CATEGORIES.includes(body.category) ? body.category : null;
  if (!category) errors.push('Catégorie invalide.');

  const status = body.status === 'published' ? 'published' : 'draft';
  const publishedAt = body.publishedAt ? new Date(body.publishedAt) : null;
  if (publishedAt && Number.isNaN(publishedAt.getTime())) errors.push('Date de publication invalide.');

  const translations = {};
  for (const l of LOCALES) {
    const t = body?.translations?.[l];
    if (!t) continue;
    const title = clean(t.title, 300);
    const contentHtml = sanitizeArticleHtml(t.contentHtml);
    // Une langue sans titre ni contenu est considérée comme vide (supprimée).
    if (!title && !stripHtml(contentHtml)) {
      translations[l] = null;
      continue;
    }
    if (!title) errors.push(`Titre manquant (${l.toUpperCase()}).`);
    translations[l] = {
      title,
      excerpt: clean(t.excerpt, 1000) || stripHtml(contentHtml).slice(0, 220),
      contentHtml,
      metaTitle: clean(t.metaTitle, 300) || null,
      metaDescription: clean(t.metaDescription, 500) || null,
      machineTranslated: !!t.machineTranslated,
    };
  }
  if (!translations.fr) errors.push('La version française est obligatoire.');
  if (status === 'published' && translations.fr && !stripHtml(translations.fr.contentHtml)) {
    errors.push('Impossible de publier un article sans contenu en français.');
  }

  return {
    errors,
    data: {
      slug,
      category,
      status,
      publishedAt: publishedAt || (status === 'published' ? new Date() : null),
      coverImage: clean(body.coverImage, 500) || null,
      author: clean(body.author, 120) || 'Aymen Promotion',
    },
    translations,
  };
}

async function saveTranslations(post, translations, transaction) {
  for (const [locale, t] of Object.entries(translations)) {
    const existing = await db.BlogPostTranslation.findOne({ where: { postId: post.id, locale }, transaction });
    if (t === null) {
      if (existing) await existing.destroy({ transaction });
    } else if (existing) {
      await existing.update(t, { transaction });
    } else {
      await db.BlogPostTranslation.create({ ...t, postId: post.id, locale }, { transaction });
    }
  }
}

const withTranslations = { include: [{ model: db.BlogPostTranslation, as: 'translations' }] };

exports.list = async (req, res) => {
  const posts = await db.BlogPost.findAll({
    ...withTranslations,
    order: [['publishedAt', 'DESC'], ['id', 'DESC']],
  });
  res.json({ items: posts.map(serializeAdmin), categories: CATEGORIES, translateProvider: providerName() });
};

exports.get = async (req, res) => {
  const post = await db.BlogPost.findByPk(req.params.id, withTranslations);
  if (!post) return res.status(404).json({ message: 'Article introuvable.' });
  res.json(serializeAdmin(post));
};

exports.create = async (req, res) => {
  const { errors, data, translations } = readPayload(req.body || {});
  if (errors.length) return res.status(400).json({ message: errors.join(' '), errors });
  if (await db.BlogPost.findOne({ where: { slug: data.slug } })) {
    return res.status(409).json({ message: `Le slug « ${data.slug} » est déjà utilisé par un autre article.` });
  }
  const post = await db.sequelize.transaction(async (transaction) => {
    const created = await db.BlogPost.create(data, { transaction });
    await saveTranslations(created, translations, transaction);
    return created;
  });
  const full = await db.BlogPost.findByPk(post.id, withTranslations);
  notifySite(full.slug);
  res.status(201).json(serializeAdmin(full));
};

exports.update = async (req, res) => {
  const post = await db.BlogPost.findByPk(req.params.id);
  if (!post) return res.status(404).json({ message: 'Article introuvable.' });
  const { errors, data, translations } = readPayload(req.body || {});
  if (errors.length) return res.status(400).json({ message: errors.join(' '), errors });
  const clash = await db.BlogPost.findOne({ where: { slug: data.slug } });
  if (clash && clash.id !== post.id) {
    return res.status(409).json({ message: `Le slug « ${data.slug} » est déjà utilisé par un autre article.` });
  }
  const oldSlug = post.slug;
  await db.sequelize.transaction(async (transaction) => {
    await post.update(data, { transaction });
    await saveTranslations(post, translations, transaction);
  });
  const full = await db.BlogPost.findByPk(post.id, withTranslations);
  notifySite(full.slug);
  if (oldSlug !== full.slug) notifySite(oldSlug);
  res.json(serializeAdmin(full));
};

exports.remove = async (req, res) => {
  const post = await db.BlogPost.findByPk(req.params.id);
  if (!post) return res.status(404).json({ message: 'Article introuvable.' });
  const { slug } = post;
  await db.sequelize.transaction(async (transaction) => {
    await db.BlogPostTranslation.destroy({ where: { postId: post.id }, transaction });
    await post.destroy({ transaction });
  });
  notifySite(slug);
  res.json({ ok: true });
};

/** POST /api/admin/uploads (champ « file ») -> { url } */
exports.upload = (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucune image reçue.' });
  res.status(201).json({ url: `/uploads/blog/${req.file.filename}` });
};

/** POST /api/admin/translate { from, to, fields } -> { provider, fields } */
exports.translate = async (req, res) => {
  const from = LOCALES.includes(req.body?.from) ? req.body.from : 'fr';
  const to = LOCALES.includes(req.body?.to) ? req.body.to : null;
  if (!to || to === from) return res.status(400).json({ message: 'Langue cible invalide.' });
  const fields = {};
  for (const k of ['title', 'excerpt', 'metaTitle', 'metaDescription', 'contentHtml']) {
    if (req.body?.fields?.[k]) fields[k] = String(req.body.fields[k]);
  }
  if (!Object.keys(fields).length) return res.status(400).json({ message: 'Rien à traduire.' });
  try {
    const out = await translateFields({ from, to, fields });
    if (out.fields.contentHtml) out.fields.contentHtml = sanitizeArticleHtml(out.fields.contentHtml);
    res.json(out);
  } catch (err) {
    console.error('[blog] translate', err.message);
    const quota = err.status === 429 || err.status === 403 || /quota|limit/i.test(err.message);
    res.status(502).json({
      message: quota
        ? 'Quota du service de traduction gratuit atteint. Réessayez demain ou traduisez à la main.'
        : `La traduction automatique a échoué : ${err.message}`,
    });
  }
};
