const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const db = {
  sequelize,
  Sequelize: sequelize.constructor,
};

// Import models
db.Candidate = require('./candidate')(sequelize, DataTypes);
db.Locality = require('./locality')(sequelize, DataTypes);
db.Project = require('./project')(sequelize, DataTypes);
db.ProjectImage = require('./projectImage')(sequelize, DataTypes);
db.Contact = require('./contact')(sequelize, DataTypes);

// Associations
// Locality <-> Projects (One Locality has many Projects)
db.Locality.hasMany(db.Project, { foreignKey: 'localityId', as: 'projects' });
db.Project.belongsTo(db.Locality, { foreignKey: 'localityId', as: 'locality' });

// Project <-> Images (One Project has many Images)
db.Project.hasMany(db.ProjectImage, { foreignKey: 'projectId', as: 'images' });
db.ProjectImage.belongsTo(db.Project, { foreignKey: 'projectId', as: 'project' });

module.exports = db;
