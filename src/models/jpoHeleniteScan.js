// Journal de chaque scan (date/heure, commercial, doublon ou non) : base des statistiques par jour / heure.
module.exports = (sequelize, DataTypes) => {
  const JpoHeleniteScan = sequelize.define('JpoHeleniteScan', {
    registrationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'registration_id' },
    leadId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'lead_id' },
    agentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'agent_id' },
    // true = la personne avait déjà été scannée (par ce commercial ou un autre).
    isDuplicate: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_duplicate' },
  }, {
    tableName: 'jpo_helenite_scans',
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['registration_id'], name: 'jpo_helenite_scans_registration' },
      { fields: ['agent_id'], name: 'jpo_helenite_scans_agent' },
      { fields: ['created_at'], name: 'jpo_helenite_scans_created' },
    ],
  });
  return JpoHeleniteScan;
};
