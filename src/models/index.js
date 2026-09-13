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
  db.TerrainRequest = require('./terrainRequest')(sequelize, DataTypes);
  db.SalesAgent = require('./salesAgent')(sequelize, DataTypes);
  db.BatimatechLead = require('./batimatechLead')(sequelize, DataTypes);
  db.ConcoursBatitecApplication = require('./concoursBatitecApplication')(sequelize, DataTypes);
  db.Newsletter = require('./newsletter')(sequelize, DataTypes);
  db.OffreEteLead = require('./offreEteLead')(sequelize, DataTypes);
  db.VisiteVirtuelleRdv = require('./visiteVirtuelleRdv')(sequelize, DataTypes);
  db.BatimatPreinscription = require('./batimatPreinscription')(sequelize, DataTypes);
  db.QrScan = require('./qrScan')(sequelize, DataTypes);
  
  // Vérifions que le fichier quote.js existe
  console.log('Tentative de chargement de quote.js...');
  const quoteModel = require('./quote');
  console.log('quoteModel chargé:', typeof quoteModel);
  db.Quote = quoteModel(sequelize, DataTypes);
  console.log('db.Quote après chargement:', !!db.Quote);

  // Module mobile Aymen Promotion (ajout additif, tables préfixées mobile_)
  db.MobileUser = require('./mobile/mobileUser')(sequelize, DataTypes);
  db.MobileOtpChallenge = require('./mobile/mobileOtpChallenge')(sequelize, DataTypes);
  db.MobileAuthSession = require('./mobile/mobileAuthSession')(sequelize, DataTypes);
  db.MobileDevice = require('./mobile/mobileDevice')(sequelize, DataTypes);
  db.MobileFavorite = require('./mobile/mobileFavorite')(sequelize, DataTypes);
  db.MobileInterestProfile = require('./mobile/mobileInterestProfile')(sequelize, DataTypes);
  db.MobileAppointment = require('./mobile/mobileAppointment')(sequelize, DataTypes);
  db.MobileNotification = require('./mobile/mobileNotification')(sequelize, DataTypes);
  db.MobileConsent = require('./mobile/mobileConsent')(sequelize, DataTypes);
  db.MobileEvent = require('./mobile/mobileEvent')(sequelize, DataTypes);

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

if (db.SalesAgent && db.BatimatechLead) {
  db.SalesAgent.hasMany(db.BatimatechLead, { foreignKey: 'salesAgentId', as: 'leads' });
  db.BatimatechLead.belongsTo(db.SalesAgent, { foreignKey: 'salesAgentId', as: 'salesAgent' });
}

// Associations du module mobile (additif)
if (db.MobileUser && db.MobileFavorite) {
  db.MobileUser.hasMany(db.MobileFavorite, { foreignKey: 'userId', as: 'favorites' });
  db.MobileFavorite.belongsTo(db.MobileUser, { foreignKey: 'userId', as: 'user' });
}
if (db.MobileFavorite && db.Project) {
  db.Project.hasMany(db.MobileFavorite, { foreignKey: 'projectId', as: 'mobileFavorites' });
  db.MobileFavorite.belongsTo(db.Project, { foreignKey: 'projectId', as: 'project' });
}
if (db.MobileUser && db.MobileAppointment) {
  db.MobileUser.hasMany(db.MobileAppointment, { foreignKey: 'userId', as: 'appointments' });
  db.MobileAppointment.belongsTo(db.MobileUser, { foreignKey: 'userId', as: 'user' });
}
if (db.MobileAppointment && db.Project) {
  db.MobileAppointment.belongsTo(db.Project, { foreignKey: 'projectId', as: 'project' });
}
if (db.MobileUser && db.MobileNotification) {
  db.MobileUser.hasMany(db.MobileNotification, { foreignKey: 'userId', as: 'notifications' });
  db.MobileNotification.belongsTo(db.MobileUser, { foreignKey: 'userId', as: 'user' });
}
if (db.MobileUser && db.MobileAuthSession) {
  db.MobileUser.hasMany(db.MobileAuthSession, { foreignKey: 'userId', as: 'sessions' });
}
if (db.MobileUser && db.MobileInterestProfile) {
  db.MobileUser.hasOne(db.MobileInterestProfile, { foreignKey: 'userId', as: 'interestProfile' });
}
if (db.MobileUser && db.MobileConsent) {
  db.MobileUser.hasMany(db.MobileConsent, { foreignKey: 'userId', as: 'consents' });
}

console.log('Tous les modèles chargés:', Object.keys(db));
module.exports = db;
