module.exports = (sequelize, DataTypes) => {
  const MobileNotification = sequelize.define('MobileNotification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'service',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    body: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    targetRoute: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'mobile_notifications',
    indexes: [{ fields: ['userId'] }],
  });

  return MobileNotification;
};
