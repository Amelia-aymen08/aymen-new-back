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
      allowNull: false,
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
  }, {
    tableName: 'offres_ete_leads',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['email', 'phone'],
        name: 'offres_ete_leads_email_phone_unique',
      },
    ],
  });

  return OffreEteLead;
};
