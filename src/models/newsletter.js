module.exports = (sequelize, DataTypes) => {
  const Newsletter = sequelize.define('Newsletter', {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    source: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'footer',
    },
  });
  return Newsletter;
};
