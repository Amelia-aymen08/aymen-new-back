// Journal de chaque passage de badge devant un commercial (date/heure, commercial, doublon ou non).
module.exports = (sequelize, DataTypes) => {
  const JpoNiceScan = sequelize.define('JpoNiceScan', {
    registrationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'registration_id' },
    leadId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'lead_id' },
    agentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'agent_id' },
    // true = la personne avait déjà été checkée (par ce commercial ou un autre, ou affectée par l'accueil).
    isDuplicate: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_duplicate' },
  }, {
    tableName: 'jpo_nice_scans',
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['registration_id'], name: 'jpo_nice_scans_registration' },
      { fields: ['agent_id'], name: 'jpo_nice_scans_agent' },
      { fields: ['created_at'], name: 'jpo_nice_scans_created' },
    ],
  });
  return JpoNiceScan;
};
