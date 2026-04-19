module.exports = (sequelize, DataTypes) => {
  const ConcoursBatitecApplication = sequelize.define(
    'ConcoursBatitecApplication',
    {
      category: {
        type: DataTypes.ENUM('HOTEL', 'VILLA'),
        allowNull: false,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { isEmail: true },
      },
      studentCardPath: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      studentCardMime: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      tableName: 'concours_batitec_applications',
    }
  );

  return ConcoursBatitecApplication;
};
