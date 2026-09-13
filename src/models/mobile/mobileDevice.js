module.exports = (sequelize, DataTypes) => {
  const MobileDevice = sequelize.define('MobileDevice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    installationId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    platform: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    pushToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'mobile_devices',
    indexes: [{ fields: ['userId'] }, { unique: true, fields: ['installationId'] }],
  });

  return MobileDevice;
};
