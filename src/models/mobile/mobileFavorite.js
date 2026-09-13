module.exports = (sequelize, DataTypes) => {
  const MobileFavorite = sequelize.define('MobileFavorite', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    projectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'mobile_favorites',
    indexes: [{ unique: true, fields: ['userId', 'projectId'] }],
  });

  return MobileFavorite;
};
