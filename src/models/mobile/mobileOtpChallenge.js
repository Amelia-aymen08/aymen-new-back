module.exports = (sequelize, DataTypes) => {
  const MobileOtpChallenge = sequelize.define('MobileOtpChallenge', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    destination: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    purpose: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'login',
    },
    codeHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    resendAvailableAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    consumedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'mobile_otp_challenges',
    indexes: [{ fields: ['destination', 'purpose'] }],
  });

  return MobileOtpChallenge;
};
