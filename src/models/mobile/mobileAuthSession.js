module.exports = (sequelize, DataTypes) => {
  const MobileAuthSession = sequelize.define('MobileAuthSession', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    familyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    refreshTokenHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    deviceId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    platform: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'mobile_auth_sessions',
    indexes: [{ fields: ['userId'] }, { fields: ['familyId'] }],
  });

  return MobileAuthSession;
};
