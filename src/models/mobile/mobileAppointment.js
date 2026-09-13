module.exports = (sequelize, DataTypes) => {
  const MobileAppointment = sequelize.define('MobileAppointment', {
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
      allowNull: true,
    },
    mode: {
      type: DataTypes.ENUM('showroom', 'video', 'phone'),
      allowNull: false,
      defaultValue: 'showroom',
    },
    startAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    timezone: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'Africa/Algiers',
    },
    status: {
      type: DataTypes.ENUM('confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show'),
      allowNull: false,
      defaultValue: 'confirmed',
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    idempotencyKey: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    crmSyncStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
    },
    notes: {
      type: DataTypes.STRING(280),
      allowNull: true,
    },
  }, {
    tableName: 'mobile_appointments',
    indexes: [{ fields: ['userId'] }, { fields: ['startAt'] }],
  });

  return MobileAppointment;
};
