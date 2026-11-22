// Localité (commune) : page /localite/<slug> du site et onglet « Localités ».
// Description française ici, traductions EN / AR dans locality_translations.
module.exports = (sequelize, DataTypes) => {
  const Locality = sequelize.define('Locality', {
    // Nom court affiché, ex. « Hydra ».
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Grande image (haut de la page localité).
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Adresse de la page : /localite/<slug> (unicité vérifiée par le back-office).
    slug: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    // Pictogramme (silhouette de la commune) des cartes « Localités ».
    iconImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    // Image du haut de page sur mobile (format portrait), facultative.
    mobileImageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    published: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  });

  return Locality;
};
