module.exports = (sequelize, DataTypes) => {
  const BatimatPreinscription = sequelize.define('BatimatPreinscription', {
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'first_name',
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'last_name',
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true },
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    profile: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    newsletterOptIn: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'newsletter_opt_in',
    },
    consent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    statut: {
      // Volontairement un VARCHAR et non un ENUM : les ENUM MySQL avec des
      // valeurs accentuées ('confirmé', 'annulé') sont fragiles avec Sequelize
      // (`sync({ alter: false })` ne met jamais l'ENUM à jour, et MySQL en mode
      // non strict remplace silencieusement une valeur invalide par ''), ce qui
      // faisait « revenir » le statut à sa valeur initiale après actualisation.
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'nouveau',
      validate: {
        isIn: [['nouveau', 'confirmé', 'annulé']],
      },
    },
    qrCampaign: {
      type: DataTypes.STRING(60),
      allowNull: true,
      field: 'qr_campaign',
    },
    qrSource: {
      type: DataTypes.STRING(60),
      allowNull: true,
      field: 'qr_source',
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address',
    },
  }, {
    tableName: 'batimat_preinscriptions',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['email', 'phone'],
        name: 'batimat_preinscriptions_email_phone_unique',
      },
    ],
  });

  return BatimatPreinscription;
};
