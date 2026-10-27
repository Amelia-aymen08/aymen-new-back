// Journal des entrées et sorties enregistrées par l'accueil de la JPO Nice. L'état d'un visiteur se déduit
// de son dernier passage : « out » = sorti, sinon présent (s'il est arrivé).
module.exports = (sequelize, DataTypes) => {
  const JpoNicePassage = sequelize.define('JpoNicePassage', {
    registrationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'registration_id' },
    agentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'agent_id' },
    // 'in' | 'out'
    direction: { type: DataTypes.STRING(3), allowNull: false },
  }, {
    tableName: 'jpo_nice_passages',
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['registration_id'], name: 'jpo_nice_passages_registration' },
      { fields: ['created_at'], name: 'jpo_nice_passages_created' },
    ],
  });
  return JpoNicePassage;
};
