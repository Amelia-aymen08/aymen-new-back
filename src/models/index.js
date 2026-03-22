// models/index.js
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const db = {
  sequelize,
  Sequelize: sequelize.constructor,
};

// Import models
try {
  console.log('Chargement des modèles...');
  
  db.Candidate = require('./candidate')(sequelize, DataTypes);
  db.Locality = require('./locality')(sequelize, DataTypes);
  db.Project = require('./project')(sequelize, DataTypes);
  db.ProjectImage = require('./projectImage')(sequelize, DataTypes);
  db.Contact = require('./contact')(sequelize, DataTypes);
  db.HomeContact = require('./homeContact')(sequelize, DataTypes);
  
  // Vérifions que le fichier quote.js existe
  console.log('Tentative de chargement de quote.js...');
  const quoteModel = require('./quote');
  console.log('quoteModel chargé:', typeof quoteModel);
  db.Quote = quoteModel(sequelize, DataTypes);
  console.log('db.Quote après chargement:', !!db.Quote);
  
} catch (error) {
  console.error('Erreur lors du chargement des modèles:', error);
}

// Associations
if (db.Locality && db.Project) {
  db.Locality.hasMany(db.Project, { foreignKey: 'localityId', as: 'projects' });
  db.Project.belongsTo(db.Locality, { foreignKey: 'localityId', as: 'locality' });
}

if (db.Project && db.ProjectImage) {
  db.Project.hasMany(db.ProjectImage, { foreignKey: 'projectId', as: 'images' });
  db.ProjectImage.belongsTo(db.Project, { foreignKey: 'projectId', as: 'project' });
}

console.log('Tous les modèles chargés:', Object.keys(db));
module.exports = db;
