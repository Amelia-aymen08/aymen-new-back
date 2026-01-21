module.exports = (sequelize, DataTypes) => {
  const Contact = sequelize.define('Contact', {
    fullName: {
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
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING, // 'contact', 'newsletter', etc.
      defaultValue: 'contact',
    },
  });

  return Contact;
};
