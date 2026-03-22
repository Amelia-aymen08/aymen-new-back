// controllers/quoteController.js
const db = require('../models');

console.log('=== CHARGEMENT DU CONTROLLER QUOTE ===');
console.log('db.Quote disponible:', !!db.Quote);
console.log('=======================================');

const createQuote = async (req, res) => {
  console.log('📝 createQuote appelée');
  
  try {
    const { 
      email, firstName, lastName, phone, country, wilaya,
      budget, profession, financing, interest,
      locations, contactDays, contactTime, projectStatus,
      consent, sourceProject
    } = req.body;

    console.log('Données reçues:', { firstName, lastName, email, phone });

    // Validation de base
    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Les champs obligatoires (Nom, Prénom, Email, Téléphone) doivent être remplis !"
      });
    }

    // Vérification que db.Quote existe
    if (!db.Quote) {
      console.error('❌ db.Quote est undefined!');
      return res.status(500).json({
        success: false,
        message: "Erreur de configuration serveur",
        error: "Modèle Quote non disponible"
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

    console.log('Création du devis...');
    const data = await db.Quote.create(quoteData);
    console.log('✅ Devis créé avec succès, ID:', data.id);
    
    res.status(201).json({
      success: true,
      message: "Votre demande de devis a été envoyée avec succès !",
      data: data
    });
  } catch (err) {
    console.error("❌ Erreur dans createQuote:", err);
    res.status(500).json({
      success: false,
      message: err.message,
      error: err.toString()
    });
  }
};

const findAll = async (req, res) => {
  console.log('🔍 findAll appelée');
  
  try {
    if (!db.Quote) {
      console.error('❌ db.Quote est undefined dans findAll!');
      return res.status(500).json({
        success: false,
        message: "Erreur de configuration serveur",
        error: "Modèle Quote non disponible"
      });
    }
    
    console.log('Exécution de db.Quote.findAll()...');
    const data = await db.Quote.findAll({
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`✅ ${data.length} devis trouvés`);
    res.json({
      success: true,
      data: data
    });
  } catch (err) {
    console.error('❌ Erreur dans findAll:', err);
    res.status(500).json({
      success: false,
      message: err.message || "Une erreur est survenue lors de la récupération des devis."
    });
  }
};

module.exports = {
  createQuote,
  findAll
};