module.exports = (sequelize, DataTypes) => {
  const ProjectImage = sequelize.define('ProjectImage', {
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isCover: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    caption: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  });

  return ProjectImage;
};
