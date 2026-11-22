// Textes d'un projet en anglais / arabe (le français est dans la table Projects).
// Une langue est « disponible » sur le site dès que sa description courte ou longue est remplie.
module.exports = (sequelize, DataTypes) => {
  const ProjectTranslation = sequelize.define('ProjectTranslation', {
    projectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'project_id',
    },
    locale: {
      type: DataTypes.ENUM('en', 'ar'),
      allowNull: false,
    },
    shortDescription: {
      type: DataTypes.STRING(400),
      allowNull: true,
      field: 'short_description',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    typology: {
      type: DataTypes.STRING(120),
      allowNull: true,
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
    // Produit par la traduction automatique et pas encore relu.
    machineTranslated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'machine_translated',
    },
  }, {
    tableName: 'project_translations',
    // utf8mb4 : textes arabes (la base par défaut du serveur n'est pas en UTF-8 complet).
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['project_id', 'locale'], name: 'project_translations_project_locale' },
    ],
  });

  return ProjectTranslation;
};
