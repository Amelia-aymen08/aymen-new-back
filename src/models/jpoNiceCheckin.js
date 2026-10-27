// Arrivée d'un visiteur à la JPO Nice : une ligne par inscription (première arrivée conservée).
module.exports = (sequelize, DataTypes) => {
  const JpoNiceCheckin = sequelize.define('JpoNiceCheckin', {
    registrationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true, field: 'registration_id' },
    agentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'agent_id' },
    checkedInAt: { type: DataTypes.DATE, allowNull: false, field: 'checked_in_at' },
    // Nombre de passages de badge à l'accueil (rescans compris).
    scanCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'scan_count' },
  }, {
    tableName: 'jpo_nice_checkins',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['checked_in_at'], name: 'jpo_nice_checkins_at' }],
  });
  return JpoNiceCheckin;
};
