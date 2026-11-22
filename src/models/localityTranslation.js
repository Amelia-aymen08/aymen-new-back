// Description d'une localité en anglais / arabe (le français est dans la table Localities).
module.exports = (sequelize, DataTypes) => {
  const LocalityTranslation = sequelize.define('LocalityTranslation', {
    localityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'locality_id',
    },
    locale: {
      type: DataTypes.ENUM('en', 'ar'),
      allowNull: false,
    },
    // Nom court dans la langue (ex. « القبة » pour Kouba) ; vide = nom français.
    name: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    machineTranslated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'machine_translated',
    },
  }, {
    tableName: 'locality_translations',
    // utf8mb4 : textes arabes (la base par défaut du serveur n'est pas en UTF-8 complet).
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['locality_id', 'locale'], name: 'locality_translations_locality_locale' },
    ],
  });

  return LocalityTranslation;
};
