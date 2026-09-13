module.exports = (sequelize, DataTypes) => {
  const MobileEvent = sequelize.define('MobileEvent', {
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
      allowNull: true,
    },
    eventName: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
    eventVersion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    occurredAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  }, {
    tableName: 'mobile_events',
    indexes: [{ fields: ['eventName'] }, { fields: ['occurredAt'] }],
  });

  return MobileEvent;
};
