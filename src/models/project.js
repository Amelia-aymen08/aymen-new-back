module.exports = (sequelize, DataTypes) => {
  const Project = sequelize.define('Project', {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('en_cours', 'livre', 'bientot'),
      defaultValue: 'en_cours',
    },
    type: {
      type: DataTypes.ENUM('residentiel', 'commercial', 'luxe', 'mixte'),
      defaultValue: 'residentiel',
    },
    address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    features: {
      type: DataTypes.JSON, // Stores array of features like ["Piscine", "Parking"]
      allowNull: true,
    },
    deliveryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    // Résumé court pour les cartes (catalogue), distinct de `description`
    // qui reste la description longue de la fiche projet. Alimenté depuis
    // mockData.ts (cf. scripts/seedFromCatalogJson.js).
    shortDescription: {
      type: DataTypes.STRING(280),
      allowNull: true,
    },
    // Avancement chantier en %, quand une valeur chiffrée réelle existe
    // (ex. "45 %" dans mockData.ts). Null si aucune donnée réelle
    // disponible — jamais une valeur inventée (cahier §8.3).
    progressPercent: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  });

  return Project;
};
