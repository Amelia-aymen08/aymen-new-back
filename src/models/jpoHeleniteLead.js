// Prospect = un visiteur inscrit (jpo_helenite_registrations) scanné par un commercial.
// Une seule ligne par inscription : le premier commercial qui scanne en devient le propriétaire.
module.exports = (sequelize, DataTypes) => {
  const JpoHeleniteLead = sequelize.define('JpoHeleniteLead', {
    registrationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true, field: 'registration_id' },
    agentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'agent_id' },
    firstScannedAt: { type: DataTypes.DATE, allowNull: false, field: 'first_scanned_at' },
    lastScannedAt: { type: DataTypes.DATE, allowNull: false, field: 'last_scanned_at' },
    scanCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'scan_count' },
    // 'hot' | 'warm' | 'cold' (VARCHAR, pas d'ENUM)
    temperature: { type: DataTypes.STRING(10), allowNull: true },
    rating: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
    // a_contacter | contacte | rdv_a_confirmer | rdv_confirme | a_relancer | qualifie | sans_suite
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'a_contacter' },
    note: { type: DataTypes.TEXT, allowNull: true },
    nextAction: { type: DataTypes.STRING(255), allowNull: true, field: 'next_action' },
    followUpAt: { type: DataTypes.DATE, allowNull: true, field: 'follow_up_at' },
    // Date de la 1re saisie du commercial : NULL = prospect scanné mais pas encore traité.
    treatedAt: { type: DataTypes.DATE, allowNull: true, field: 'treated_at' },
  }, {
    tableName: 'jpo_helenite_leads',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['agent_id'], name: 'jpo_helenite_leads_agent' },
      { fields: ['status'], name: 'jpo_helenite_leads_status' },
      { fields: ['follow_up_at'], name: 'jpo_helenite_leads_follow_up' },
    ],
  });
  return JpoHeleniteLead;
};
