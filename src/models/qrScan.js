module.exports = (sequelize, DataTypes) => {
  const QrScan = sequelize.define('QrScan', {
    // Identifiant de campagne encodé dans le QR code (ex: "flyer", "batimat-bache").
    campaign: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
    source: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    medium: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    // Page d'arrivée (pathname) au moment du scan.
    landingPath: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'landing_path',
    },
    referrer: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'user_agent',
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address',
    },
    // Identifiant aléatoire stocké dans le localStorage du visiteur : permet de
    // distinguer les visiteurs uniques des scans totaux (une même personne qui
    // revient plusieurs jours).
    visitorId: {
      type: DataTypes.STRING(40),
      allowNull: true,
      field: 'visitor_id',
    },
    isBot: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_bot',
    },
    // true = scan déduit (QR imprimé figé, sans paramètre) plutôt que confirmé
    // par un paramètre d'URL. Sert à afficher "estimation" dans le dashboard.
    isHeuristic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_heuristic',
    },
  }, {
    tableName: 'qr_scans',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['campaign'] },
      { fields: ['created_at'] },
      { fields: ['visitor_id'] },
    ],
  });

  return QrScan;
};
