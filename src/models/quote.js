module.exports = (sequelize, DataTypes) => {
  const Quote = sequelize.define('Quote', {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    wilaya: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    budget: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    profession: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    financing: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    interest: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    locations: {
      type: DataTypes.JSON, // Array of strings
      allowNull: true,
    },
    contactDays: {
      type: DataTypes.JSON, // Array of strings
      allowNull: true,
    },
    contactTime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    projectStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    consent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    sourceProject: {
      type: DataTypes.STRING, // To know which project page it came from
      allowNull: true,
    },
  });

  return Quote;
};
