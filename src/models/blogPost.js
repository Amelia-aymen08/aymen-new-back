// Article de blog (partie commune aux 3 langues).
// Les textes (titre, résumé, contenu, SEO) sont dans blog_post_translations, une ligne par langue.
module.exports = (sequelize, DataTypes) => {
  const BlogPost = sequelize.define('BlogPost', {
    // Adresse publique : /blog/<slug>, /en/blog/<slug>, /ar/blog/<slug> (identique dans les 3 langues).
    slug: {
      type: DataTypes.STRING(190),
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'published'),
      allowNull: false,
      defaultValue: 'draft',
    },
    // Clé de catégorie (libellés traduits côté frontend) : evenement, amenagement-decoration,
    // investissement, achat-vente, style-de-vie, gestion-copropriete.
    category: {
      type: DataTypes.STRING(60),
      allowNull: false,
      defaultValue: 'style-de-vie',
    },
    // Chemin relatif (/uploads/blog/xxx.webp) ou URL absolue.
    coverImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'cover_image',
    },
    author: {
      type: DataTypes.STRING(120),
      allowNull: true,
      defaultValue: 'Aymen Promotion',
    },
    // Date affichée sur l'article (et utilisée pour le tri).
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'published_at',
    },
    // Article importé de l'ancien Strapi (archive.org) : utile pour le suivi.
    legacySource: {
      type: DataTypes.STRING(60),
      allowNull: true,
      field: 'legacy_source',
    },
  }, {
    tableName: 'blog_posts',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['status', 'published_at'], name: 'blog_posts_status_published' },
    ],
  });

  return BlogPost;
};
