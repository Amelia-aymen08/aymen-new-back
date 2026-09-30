module.exports = (sequelize, DataTypes) => {
  const BatimatAfterRegistration = sequelize.define('BatimatAfterRegistration', {
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
    // 'samedi' | 'dimanche' | 'flexible'
    visitDay: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'visit_day',
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
    // Identifiant unique encodé dans le QR code du badge (lu par l'app de scan).
    qrToken: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
      field: 'qr_token',
    },
    badgeSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'badge_sent_at',
    },
    // Renseignés par l'application de scan (check-in / check-out).
    checkedInAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'checked_in_at',
    },
    checkedOutAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'checked_out_at',
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
    tableName: 'batimat_after_registrations',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['email', 'phone'],
        name: 'batimat_after_registrations_email_phone_unique',
      },
    ],
  });

  return BatimatAfterRegistration;
};
