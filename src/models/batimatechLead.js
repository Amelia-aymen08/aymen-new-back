module.exports = (sequelize, DataTypes) => {
  const BatimatechLead = sequelize.define(
    'BatimatechLead',
    {
      salesAgentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      salesAgentName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      prospectLastName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      prospectFirstName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: { isEmail: true },
      },
      projectName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      appointmentDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      appointmentSlot: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING(1200),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'nouveau',
      },
    },
    {
      tableName: 'batimatech_leads',
    }
  );

  return BatimatechLead;
};
