// index.js - CORRIGÉ
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const db = {
  sequelize,
  Sequelize: sequelize.constructor,
};

// Import models - Vérifiez que les chemins sont corrects
db.Candidate = require('./candidate')(sequelize, DataTypes);
db.Locality = require('./locality')(sequelize, DataTypes);
db.Project = require('./project')(sequelize, DataTypes);
db.ProjectImage = require('./projectImage')(sequelize, DataTypes);
db.Contact = require('./contact')(sequelize, DataTypes);
db.Quote = require('./quote')(sequelize, DataTypes); // <-- AJOUTEZ CETTE LIGNE

// Associations
db.Locality.hasMany(db.Project, { foreignKey: 'localityId', as: 'projects' });
db.Project.belongsTo(db.Locality, { foreignKey: 'localityId', as: 'locality' });

db.Project.hasMany(db.ProjectImage, { foreignKey: 'projectId', as: 'images' });
db.ProjectImage.belongsTo(db.Project, { foreignKey: 'projectId', as: 'project' });

module.exports = db;