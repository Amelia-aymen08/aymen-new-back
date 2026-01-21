module.exports = (sequelize, DataTypes) => {
  const Project = sequelize.define('Project', {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('en_cours', 'livre', 'bientot'),
      defaultValue: 'en_cours',
    },
    type: {
      type: DataTypes.ENUM('residentiel', 'commercial', 'luxe', 'mixte'),
      defaultValue: 'residentiel',
    },
    address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    features: {
      type: DataTypes.JSON, // Stores array of features like ["Piscine", "Parking"]
      allowNull: true,
    },
    deliveryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    coverImage: {
      type: DataTypes.STRING,
      allowNull: true,
    }
  });

  return Project;
};
