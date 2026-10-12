module.exports = (sequelize, DataTypes) => {
  const JpoHeleniteRegistration = sequelize.define('JpoHeleniteRegistration', {
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'first_name',
    },
    lastName: {
      type: DataTypes.STRING(100),
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
    // Date ISO du jour choisi (2026-10-23 … 2026-10-29).
    visitDate: {
      type: DataTypes.STRING(10),
      allowNull: false,
      field: 'visit_date',
    },
    // Créneau horaire, ex. « 15h - 16h ».
    timeSlot: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'time_slot',
    },
    // Bloc « Préciser mon projet » (facultatif).
    profile: { type: DataTypes.STRING(60), allowNull: true },
    typology: { type: DataTypes.STRING(60), allowNull: true },
    horizon: { type: DataTypes.STRING(60), allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: true },
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
    // 'nouveau' | 'confirme' | 'annule' — VARCHAR, pas d'ENUM.
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'nouveau',
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
    tableName: 'jpo_helenite_registrations',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['email', 'phone'],
        name: 'jpo_helenite_registrations_email_phone_unique',
      },
      {
        fields: ['visit_date', 'time_slot'],
        name: 'jpo_helenite_registrations_visit',
      },
    ],
  });

  return JpoHeleniteRegistration;
};
