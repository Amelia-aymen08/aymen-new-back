// Comptes de l'application de scan JPO Nice : 4 commerciaux, 4 agents d'accueil (+ managers éventuels).
// Identifiant de connexion = e-mail. Mot de passe stocké uniquement sous forme de hash (scrypt).
module.exports = (sequelize, DataTypes) => {
  const JpoNiceAgent = sequelize.define('JpoNiceAgent', {
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    // 'commercial' : reçoit des prospects — 'accueil' : enregistre les arrivées et affecte un commercial — 'manager' : tout.
    role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'commercial' },
    // Visible des agents d'accueil pour choisir un commercial : 'available' | 'busy' | 'break' (VARCHAR, pas d'ENUM).
    availability: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'available' },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: 'password_hash' },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    lastLoginAt: { type: DataTypes.DATE, allowNull: true, field: 'last_login_at' },
  }, {
    tableName: 'jpo_nice_agents',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });
  return JpoNiceAgent;
};
