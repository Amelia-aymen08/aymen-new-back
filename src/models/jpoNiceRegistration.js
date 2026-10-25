module.exports = (sequelize, DataTypes) => {
  const JpoNiceRegistration = sequelize.define('JpoNiceRegistration', {
    firstName: { type: DataTypes.STRING(100), allowNull: false, field: 'first_name' },
    lastName: { type: DataTypes.STRING(100), allowNull: false, field: 'last_name' },
    email: { type: DataTypes.STRING, allowNull: false, validate: { isEmail: true } },
    phone: { type: DataTypes.STRING(50), allowNull: false },
    // 'samedi' | 'dimanche' | 'flexible'
    visitDay: { type: DataTypes.STRING(20), allowNull: false, field: 'visit_day' },
    // 'matin' | 'apres_midi' | 'flexible' | 'a_confirmer'
    timePref: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'a_confirmer', field: 'time_pref' },
    residenceCountry: { type: DataTypes.STRING(100), allowNull: true, field: 'residence_country' },
    city: { type: DataTypes.STRING(100), allowNull: true },
    // Étape 2 du formulaire (facultatif)
    profile: { type: DataTypes.STRING(60), allowNull: true },
    objective: { type: DataTypes.STRING(60), allowNull: true },
    typology: { type: DataTypes.STRING(60), allowNull: true },
    horizon: { type: DataTypes.STRING(60), allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: true },
    newsletterOptIn: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'newsletter_opt_in' },
    consent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // 'nouveau' | 'confirme' | 'annule' — VARCHAR, pas d'ENUM.
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'nouveau' },
    // Jeton unique encodé dans le QR code du badge.
    qrToken: { type: DataTypes.STRING(32), allowNull: false, unique: true, field: 'qr_token' },
    badgeSentAt: { type: DataTypes.DATE, allowNull: true, field: 'badge_sent_at' },
    // Renseignés par une éventuelle application de scan.
    checkedInAt: { type: DataTypes.DATE, allowNull: true, field: 'checked_in_at' },
    checkedOutAt: { type: DataTypes.DATE, allowNull: true, field: 'checked_out_at' },
    qrCampaign: { type: DataTypes.STRING(60), allowNull: true, field: 'qr_campaign' },
    qrSource: { type: DataTypes.STRING(60), allowNull: true, field: 'qr_source' },
    qrMedium: { type: DataTypes.STRING(60), allowNull: true, field: 'qr_medium' },
    ipAddress: { type: DataTypes.STRING(45), allowNull: true, field: 'ip_address' },
  }, {
    tableName: 'jpo_nice_registrations',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['email', 'phone'], name: 'jpo_nice_registrations_email_phone_unique' },
      { fields: ['visit_day', 'time_pref'], name: 'jpo_nice_registrations_visit' },
    ],
  });

  return JpoNiceRegistration;
};
