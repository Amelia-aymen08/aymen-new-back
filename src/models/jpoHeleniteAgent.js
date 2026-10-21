// Comptes des commerciaux (et managers) qui utilisent l'application de scan JPO Hélénite.
// Identifiant de connexion = e-mail. Mot de passe stocké uniquement sous forme de hash (scrypt).
module.exports = (sequelize, DataTypes) => {
  const JpoHeleniteAgent = sequelize.define('JpoHeleniteAgent', {
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    // 'commercial' : voit uniquement ses prospects — 'manager' : voit et modifie ceux de tous.
    role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'commercial' },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: 'password_hash' },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    lastLoginAt: { type: DataTypes.DATE, allowNull: true, field: 'last_login_at' },
  }, {
    tableName: 'jpo_helenite_agents',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });
  return JpoHeleniteAgent;
};
