module.exports = (sequelize, DataTypes) => {
  const SalesAgent = sequelize.define(
    'SalesAgent',
    {
      fullName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'sales_agents',
    }
  );

  return SalesAgent;
};
