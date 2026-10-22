// Journal des passages à l'accueil de la JPO : une ligne par ENTRÉE ou SORTIE enregistrée par le poste accueil.
// L'état d'un visiteur se déduit de son dernier passage : « out » = sorti, sinon présent (s'il est arrivé).
// Les visiteurs « arrivés » via le scan d'un commercial (table checkins) sont considérés comme présents.
module.exports = (sequelize, DataTypes) => {
  const JpoHelenitePassage = sequelize.define('JpoHelenitePassage', {
    registrationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'registration_id' },
    agentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'agent_id' },
    // 'in' | 'out'
    direction: { type: DataTypes.STRING(3), allowNull: false },
  }, {
    tableName: 'jpo_helenite_passages',
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['registration_id'], name: 'jpo_helenite_passages_registration' },
      { fields: ['created_at'], name: 'jpo_helenite_passages_created' },
    ],
  });
  return JpoHelenitePassage;
};
