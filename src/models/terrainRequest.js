module.exports = (sequelize, DataTypes) => {
  const TerrainRequest = sequelize.define(
    'TerrainRequest',
    {
      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { isEmail: true },
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      subject: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      landAddress: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      facade: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      area: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      papers: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      consent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: 'terrain_requests',
    }
  );

  return TerrainRequest;
};
