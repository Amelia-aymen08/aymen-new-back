// Arrivée d'un visiteur à la JPO : une ligne par inscription (première arrivée conservée).
// Alimentée par le poste « accueil » (scan à l'entrée) ou, à défaut, par le 1er scan d'un commercial.
module.exports = (sequelize, DataTypes) => {
  const JpoHeleniteCheckin = sequelize.define('JpoHeleniteCheckin', {
    registrationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true, field: 'registration_id' },
    agentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'agent_id' },
    checkedInAt: { type: DataTypes.DATE, allowNull: false, field: 'checked_in_at' },
    // Nombre de passages de badge à l'accueil (rescans compris).
    scanCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'scan_count' },
  }, {
    tableName: 'jpo_helenite_checkins',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['checked_in_at'], name: 'jpo_helenite_checkins_at' }],
  });
  return JpoHeleniteCheckin;
};
