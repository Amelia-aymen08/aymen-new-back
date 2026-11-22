// Photos d'un projet. isCover = grande image de couverture (aussi utilisée par l'application mobile) ;
// les autres forment la galerie, triées par sortOrder.
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
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  });

  return ProjectImage;
};
