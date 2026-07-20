module.exports = (sequelize, DataTypes) => {
  const OffreEteLead = sequelize.define('OffreEteLead', {
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
      type: DataTypes.STRING,
      allowNull: true,
    },
    preference: {
      type: DataTypes.ENUM('email', 'telephone', 'whatsapp'),
      allowNull: false,
      defaultValue: 'email',
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
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'offres_ete_leads',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return OffreEteLead;
};
