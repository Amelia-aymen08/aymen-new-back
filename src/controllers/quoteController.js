// quoteController.js - CORRIGÉ
const db = require('../models');

const createQuote = async (req, res) => {
  // Vérifiez que le modèle Quote existe
  if (!db.Quote) {
    console.error('Le modèle Quote n\'est pas chargé. Modèles disponibles:', Object.keys(db));
    return res.status(500).send({
      message: "Erreur de configuration: le modèle Quote n'est pas chargé",
      availableModels: Object.keys(db)
    });
  }

  try {
    const { 
      email, firstName, lastName, phone, country, wilaya,
      budget, profession, financing, interest,
      locations, contactDays, contactTime, projectStatus,
      consent, sourceProject
    } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).send({
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

    // Utilisez directement db.Quote
    const data = await db.Quote.create(quoteData);
    
    res.status(201).send({
      message: "Votre demande de devis a été envoyée avec succès !",
      data: data
    });
  } catch (err) {
    console.error("FULL ERROR:", err);
    res.status(500).send({
      message: err.message,
      name: err.name,
      errors: err.errors,
      parent: err.parent
    });
  }
};

const findAll = async (req, res) => {
  try {
    // Vérifiez que db.Quote existe
    if (!db.Quote) {
      throw new Error('Le modèle Quote n\'est pas disponible');
    }
    
    const data = await db.Quote.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.send(data);
  } catch (err) {
    console.error('Erreur findAll:', err);
    res.status(500).send({
      message: err.message || "Une erreur est survenue lors de la récupération des devis."
    });
  }
};

module.exports = {
  createQuote,
  findAll
};