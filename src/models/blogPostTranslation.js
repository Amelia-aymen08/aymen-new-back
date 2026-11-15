// Texte d'un article dans une langue (fr, en, ar).
// Une langue est « en ligne » si l'article est publié ET que cette traduction a un titre et un contenu.
module.exports = (sequelize, DataTypes) => {
  const BlogPostTranslation = sequelize.define('BlogPostTranslation', {
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'post_id',
    },
    locale: {
      type: DataTypes.ENUM('fr', 'en', 'ar'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    // Résumé affiché sur les cartes et utilisé comme description SEO par défaut.
    excerpt: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // HTML nettoyé (sanitize-html) produit par l'éditeur du dashboard.
    contentHtml: {
      type: DataTypes.TEXT('medium'),
      allowNull: true,
      field: 'content_html',
    },
    metaTitle: {
      type: DataTypes.STRING(300),
      allowNull: true,
      field: 'meta_title',
    },
    metaDescription: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'meta_description',
    },
    // Rempli quand le texte a été produit par la traduction automatique et pas encore relu.
    machineTranslated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'machine_translated',
    },
  }, {
    tableName: 'blog_post_translations',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['post_id', 'locale'], name: 'blog_post_translations_post_locale' },
    ],
  });

  return BlogPostTranslation;
};
