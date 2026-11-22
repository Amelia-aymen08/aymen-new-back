const jsonGetter = require('./jsonGetter');

// Projet immobilier : source unique du site (pages /projets, /projet/<slug>), du dashboard
// (/admin/projets) et de l'application mobile (/api/mobile/...).
// Les textes français sont ici ; les traductions EN / AR sont dans project_translations.
// Les colonnes ajoutées après coup sont créées au démarrage par services/catalogSchema.js.
module.exports = (sequelize, DataTypes) => {
  const Project = sequelize.define('Project', {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Adresse de la page : /projet/<slug>. Ne change plus une fois le projet publié
    // (QR codes imprimés, liens Google).
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    // Description longue (page projet), en français.
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
    // Localisation affichée, ex. « Hydra, Alger ».
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
    // Commodités, libellés français du vocabulaire fixe (ex. ["Reception", "Domotique"]).
    features: {
      type: DataTypes.JSON,
      get: jsonGetter('features'),
      allowNull: true,
    },
    deliveryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    // Résumé court pour les cartes, en français.
    shortDescription: {
      type: DataTypes.STRING(280),
      allowNull: true,
    },
    // Avancement du chantier en %. Null si inconnu (jamais une valeur inventée).
    progressPercent: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    localityId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // --- Champs du site (dashboard) ---
    // Vignette des cartes (bâtiment détouré, PNG/WebP transparent).
    cardImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    // Grande image en haut de la page projet.
    coverImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    // Carte « vue de nuit » (photo pleine carte) au lieu du bâtiment détouré.
    isNightMode: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Masqué = invisible sur le site et l'application, sans être supprimé.
    published: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    // Ordre d'affichage (croissant) dans les listes.
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    blocks: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // Typologie résumée affichée dans la fiche (ex. « F2 à F5 »), facultative.
    typology: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    // Plans : [{ type: "F3", area: "de 96 m² à 147 m²", rooms?: [{ name, area }] }]
    plans: {
      type: DataTypes.JSON,
      get: jsonGetter('plans'),
      allowNull: true,
    },
    mapEmbedUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    mapLinkUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    virtualTourUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    // Id de la résidence dans le CRM Odoo (champ residence_id des devis).
    odooResidenceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    metaTitle: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    metaDescription: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  });

  return Project;
};
