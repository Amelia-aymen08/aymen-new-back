// quoteController.js - Version avec débogage complet
const db = require('../models');

// Débogage immédiat
console.log('=== DÉBOGUAGE QUOTE CONTROLLER ===');
console.log('db object keys:', Object.keys(db));
console.log('db.Quote existe?', db.Quote);
console.log('Type de db.Quote:', typeof db.Quote);
console.log('==================================');

const createQuote = async (req, res) => {
  console.log('=== DÉBOGUAGE CREATE QUOTE ===');
  console.log('db.Quote dans la fonction:', db.Quote);
  
  // Vérification plus détaillée
  if (!db || !db.Quote) {
    console.error('❌ Problème avec db.Quote');
    console.error('db:', db);
    console.error('db keys:', Object.keys(db || {}));
    return res.status(500).json({
      success: false,
      message: "Erreur de configuration",
      error: "Modèle Quote non disponible",
      dbKeys: Object.keys(db || {})
    });
  }

  try {
    const { 
      email, firstName, lastName, phone, country, wilaya,
      budget, profession, financing, interest,
      locations, contactDays, contactTime, projectStatus,
      consent, sourceProject
    } = req.body;

    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).json({
        message: "Les champs obligatoires (Nom, Prénom, Email, Téléphone) doivent être remplis !"
      });
    }

    const quoteData = {
      email,
      firstName,
      lastName,
      phone,
      country: country || 'Algérie',
      wilaya: wilaya || null,
      budget: budget || null,
      profession: profession || null,
      financing: financing || null,
      interest: interest || null,
      locations: Array.isArray(locations) ? JSON.stringify(locations) : locations,
      contactDays: Array.isArray(contactDays) ? JSON.stringify(contactDays) : contactDays,
      contactTime,
      projectStatus,
      consent: consent === 'true' || consent === true,
      sourceProject
    };

    console.log('Création du devis avec:', quoteData);
    const data = await db.Quote.create(quoteData);
    
    res.status(201).json({
      message: "Votre demande de devis a été envoyée avec succès !",
      data: data
    });
  } catch (err) {
    console.error("FULL ERROR:", err);
    res.status(500).json({
      message: err.message,
      name: err.name,
      errors: err.errors,
      parent: err.parent
    });
  }
};

const findAll = async (req, res) => {
  console.log('=== DÉBOGUAGE FIND ALL ===');
  console.log('db.Quote:', db.Quote);
  
  try {
    if (!db.Quote) {
      throw new Error('Le modèle Quote n\'est pas disponible');
    }
    
    const data = await db.Quote.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(data);
  } catch (err) {
    console.error('Erreur findAll:', err);
    res.status(500).json({
      message: err.message || "Une erreur est survenue lors de la récupération des devis."
    });
  }
};

module.exports = {
  createQuote,
  findAll
};