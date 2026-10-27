// Prospect = un visiteur inscrit (jpo_nice_registrations) affecté à un commercial, soit par l'accueil au moment
// du check-in, soit parce que le commercial a scanné lui-même son badge. Une seule ligne par inscription :
// le premier commercial affecté en reste propriétaire (un autre commercial ne peut pas le « re-checker »).
module.exports = (sequelize, DataTypes) => {
  const JpoNiceLead = sequelize.define('JpoNiceLead', {
    registrationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true, field: 'registration_id' },
    agentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'agent_id' },
    // Agent d'accueil qui a affecté le visiteur ; NULL = le commercial a scanné lui-même le badge.
    assignedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'assigned_by_id' },
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
    // Date de la 1re saisie du commercial : NULL = prospect affecté mais pas encore traité.
    treatedAt: { type: DataTypes.DATE, allowNull: true, field: 'treated_at' },
  }, {
    tableName: 'jpo_nice_leads',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['agent_id'], name: 'jpo_nice_leads_agent' },
      { fields: ['status'], name: 'jpo_nice_leads_status' },
      { fields: ['follow_up_at'], name: 'jpo_nice_leads_follow_up' },
    ],
  });
  return JpoNiceLead;
};
