// Comptes du back-office (dashboard blog).
// Mot de passe stocké uniquement sous forme de hash scrypt (services/jpoAgentAuth.js).
// Création : node scripts/createAdminUser.js <email> [nom]
module.exports = (sequelize, DataTypes) => {
  const AdminUser = sequelize.define('AdminUser', {
    email: {
      type: DataTypes.STRING(190),
      allowNull: false,
      unique: true,
      set(value) {
        this.setDataValue('email', String(value || '').trim().toLowerCase());
      },
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash',
    },
    role: {
      type: DataTypes.ENUM('admin', 'editor'),
      allowNull: false,
      defaultValue: 'editor',
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at',
    },
  }, {
    tableName: 'admin_users',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return AdminUser;
};
