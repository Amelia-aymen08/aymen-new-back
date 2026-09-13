module.exports = (sequelize, DataTypes) => {
  const MobileConsent = sequelize.define('MobileConsent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    purpose: {
      type: DataTypes.ENUM('service', 'analytics', 'marketing'),
      allowNull: false,
    },
    state: {
      type: DataTypes.ENUM('granted', 'denied'),
      allowNull: false,
    },
    policyVersion: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '1.0',
    },
    capturedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'mobile_consents',
    indexes: [{ unique: true, fields: ['userId', 'purpose'] }],
  });

  return MobileConsent;
};
