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
      type: DataTypes.ENUM('nouveau', 'traité', 'badge_envoyé'),
      allowNull: false,
      defaultValue: 'nouveau',
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
