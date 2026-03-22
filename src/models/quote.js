// quote.js
module.exports = (sequelize, DataTypes) => {
  const Quote = sequelize.define('Quote', {
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'Algérie',
    },
    wilaya: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    budget: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    profession: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    financing: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    interest: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    locations: {
      type: DataTypes.TEXT, // Using TEXT for compatibility
      allowNull: true,
    },
    contactDays: {
      type: DataTypes.TEXT, // Using TEXT for compatibility
      allowNull: true,
    },
    contactTime: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    projectStatus: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    consent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    sourceProject: {
      type: DataTypes.STRING(150), // To know which project page it came from
      allowNull: true,
    },
  }, {
    tableName: 'Quotes',
    timestamps: true,
  });

  return Quote;
};