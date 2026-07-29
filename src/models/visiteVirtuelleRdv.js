module.exports = (sequelize, DataTypes) => {
  const VisiteVirtuelleRdv = sequelize.define('VisiteVirtuelleRdv', {
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'full_name',
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true },
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    localisations: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    consent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    statut: {
      type: DataTypes.ENUM('nouveau', 'contacté', 'converti'),
      allowNull: false,
      defaultValue: 'nouveau',
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address',
    },
  }, {
    tableName: 'visite_virtuelle_rdv',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['email', 'phone'],
        name: 'visite_virtuelle_rdv_email_phone_unique',
      },
    ],
  });

  return VisiteVirtuelleRdv;
};
