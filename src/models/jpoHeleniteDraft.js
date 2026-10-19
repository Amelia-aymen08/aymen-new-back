// Suivi des visiteurs de la page JPO Hélénite : une ligne par visiteur (identifiant aléatoire stocké
// dans son navigateur), mise à jour au fil de la saisie du formulaire — y compris s'il ne valide jamais.
// `submitted_at` / `registration_id` sont renseignés quand l'inscription est finalement validée.
module.exports = (sequelize, DataTypes) => {
  const JpoHeleniteDraft = sequelize.define('JpoHeleniteDraft', {
    visitorId: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
      field: 'visitor_id',
    },
    firstName: { type: DataTypes.STRING(100), allowNull: true, field: 'first_name' },
    lastName: { type: DataTypes.STRING(100), allowNull: true, field: 'last_name' },
    email: { type: DataTypes.STRING(255), allowNull: true },
    countryCode: { type: DataTypes.STRING(4), allowNull: true, field: 'country_code' },
    // Numéro tel que saisi (partiel possible), sans l'indicatif.
    phone: { type: DataTypes.STRING(50), allowNull: true },
    visitDate: { type: DataTypes.STRING(10), allowNull: true, field: 'visit_date' },
    timeSlot: { type: DataTypes.STRING(20), allowNull: true, field: 'time_slot' },
    profile: { type: DataTypes.STRING(60), allowNull: true },
    typology: { type: DataTypes.STRING(60), allowNull: true },
    horizon: { type: DataTypes.STRING(60), allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: true },
    newsletterOptIn: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'newsletter_opt_in' },
    consent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Dernier champ modifié : indique jusqu'où le visiteur est allé.
    lastField: { type: DataTypes.STRING(30), allowNull: true, field: 'last_field' },
    qrCampaign: { type: DataTypes.STRING(60), allowNull: true, field: 'qr_campaign' },
    qrSource: { type: DataTypes.STRING(60), allowNull: true, field: 'qr_source' },
    qrMedium: { type: DataTypes.STRING(60), allowNull: true, field: 'qr_medium' },
    referrer: { type: DataTypes.STRING(255), allowNull: true },
    isMobile: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_mobile' },
    isBot: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_bot' },
    submittedAt: { type: DataTypes.DATE, allowNull: true, field: 'submitted_at' },
    registrationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'registration_id' },
  }, {
    tableName: 'jpo_helenite_drafts',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['updated_at'], name: 'jpo_helenite_drafts_updated' },
      { fields: ['email'], name: 'jpo_helenite_drafts_email' },
    ],
  });

  return JpoHeleniteDraft;
};
