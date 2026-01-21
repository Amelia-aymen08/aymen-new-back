module.exports = (sequelize, DataTypes) => {
  const Candidate = sequelize.define('Candidate', {
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
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    department: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    position: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    portfolioUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cvPath: {
      type: DataTypes.STRING,
      allowNull: true, // We will store the path to the uploaded file
    },
  });

  return Candidate;
};
