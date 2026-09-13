module.exports = (sequelize, DataTypes) => {
  const MobileInterestProfile = sequelize.define('MobileInterestProfile', {
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    objective: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    localityIds: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    typologies: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    budgetBand: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    timeframe: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    financing: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    diaspora: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  }, {
    tableName: 'mobile_interest_profiles',
  });

  return MobileInterestProfile;
};
