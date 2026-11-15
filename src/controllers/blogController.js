'use strict';
// API publique du blog (lue par le site Next.js).
const { Op } = require('sequelize');
const db = require('../models');

const LOCALES = ['fr', 'en', 'ar'];
const pickLocale = (value) => (LOCALES.includes(value) ? value : 'fr');

// Une traduction n'est visible que si elle a un titre et un contenu.
const isComplete = (t) => !!(t && t.title && t.contentHtml && t.contentHtml.trim());

function availableLocales(post) {
  return LOCALES.filter((l) => isComplete((post.translations || []).find((t) => t.locale === l)));
}

function serializeCard(post, tr) {
  return {
    slug: post.slug,
    category: post.category,
    coverImage: post.coverImage,
    author: post.author,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    title: tr.title,
    excerpt: tr.excerpt,
    locales: availableLocales(post),
  };
}

const publishedWhere = () => ({
  status: 'published',
  [Op.or]: [{ publishedAt: null }, { publishedAt: { [Op.lte]: new Date() } }],
});

/** GET /api/blog?lang=fr&category=&limit=&offset= */
exports.list = async (req, res) => {
  try {
    const lang = pickLocale(req.query.lang);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const where = publishedWhere();
    if (req.query.category) where.category = String(req.query.category);

    const posts = await db.BlogPost.findAll({
      where,
      include: [{ model: db.BlogPostTranslation, as: 'translations' }],
      order: [['publishedAt', 'DESC'], ['id', 'DESC']],
    });

    // Filtrage par langue en JS : seulement les articles traduits dans `lang`.
    const visible = posts
      .map((p) => ({ p, tr: p.translations.find((t) => t.locale === lang) }))
      .filter(({ tr }) => isComplete(tr));

    res.json({
      total: visible.length,
      items: visible.slice(offset, offset + limit).map(({ p, tr }) => serializeCard(p, tr)),
    });
  } catch (err) {
    console.error('[blog] list', err);
    res.status(500).json({ message: 'Erreur lors du chargement des articles.' });
  }
};

/** GET /api/blog/:slug?lang=fr */
exports.getBySlug = async (req, res) => {
  try {
    const lang = pickLocale(req.query.lang);
    const post = await db.BlogPost.findOne({
      where: { ...publishedWhere(), slug: String(req.params.slug) },
      include: [{ model: db.BlogPostTranslation, as: 'translations' }],
    });
    const tr = post?.translations.find((t) => t.locale === lang);
    if (!post || !isComplete(tr)) {
      return res.status(404).json({ message: 'Article introuvable.', locales: post ? availableLocales(post) : [] });
    }
    res.json({
      ...serializeCard(post, tr),
      contentHtml: tr.contentHtml,
      metaTitle: tr.metaTitle,
      metaDescription: tr.metaDescription,
    });
  } catch (err) {
    console.error('[blog] getBySlug', err);
    res.status(500).json({ message: "Erreur lors du chargement de l'article." });
  }
};

/** GET /api/blog-index : slugs + langues disponibles (sitemap, generateStaticParams). */
exports.index = async (req, res) => {
  try {
    const posts = await db.BlogPost.findAll({
      where: publishedWhere(),
      include: [{ model: db.BlogPostTranslation, as: 'translations', attributes: ['locale', 'title', 'contentHtml'] }],
      attributes: ['slug', 'updatedAt', 'publishedAt'],
      order: [['publishedAt', 'DESC']],
    });
    res.json(posts.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt, locales: availableLocales(p) })));
  } catch (err) {
    console.error('[blog] index', err);
    res.status(500).json({ message: 'Erreur.' });
  }
};
