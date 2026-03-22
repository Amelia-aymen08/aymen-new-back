// quoteController.js - VERSION CORRIGÉE
const db = require('../models');
const { Quote } = require('../models'); // Alternative import

exports.createQuote = async (req, res) => {
  console.log('=== createQuote called ===');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  
  // Vérification détaillée
  console.log('db object type:', typeof db);
  console.log('db keys:', Object.keys(db));
  
  let QuoteModel = null;
  
  // Essayer plusieurs façons d'accéder au modèle
  if (db.Quote) {
    QuoteModel = db.Quote;
    console.log('✓ Found db.Quote');
  } else if (db.quote) {
    QuoteModel = db.quote;
    console.log('✓ Found db.quote');
  } else {
    // Essayer d'importer directement
    try {
      const QuoteModelDirect = require('../models/quote');
      const { DataTypes } = require('sequelize');
      const sequelize = require('../config/database');
      QuoteModel = QuoteModelDirect(sequelize, DataTypes);
      console.log('✓ Loaded Quote model directly');
    } catch (err) {
      console.error('✗ Failed to load Quote model directly:', err.message);
    }
  }
  
  if (!QuoteModel) {
    console.error('✗ Quote model is still undefined after all attempts');
    return res.status(500).send({
      message: "Erreur de configuration du serveur. Modèle Devis non disponible.",
      debug: {
        availableModels: Object.keys(db),
        attemptedLoad: true
      }
    });
  }

  try {
    const { 
      email, firstName, lastName, phone, country, wilaya,
      budget, profession, financing, interest,
      locations, contactDays, contactTime, projectStatus,
      consent, sourceProject
    } = req.body;

    console.log('Received data:', { firstName, lastName, email, phone });

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
      locations: locations || [],
      contactDays: contactDays || [],
      contactTime: contactTime || null,
      projectStatus: projectStatus || null,
      consent: consent === true || consent === 'true',
      sourceProject: sourceProject || null
    };

    console.log('Creating quote with data:', quoteData);
    
    const data = await QuoteModel.create(quoteData);
    
    console.log('Quote created successfully, ID:', data.id);
    
    res.status(201).send({
      message: "Votre demande de devis a été envoyée avec succès !",
      data: { id: data.id }
    });
  } catch (err) {
    console.error('Error creating quote:', err);
    console.error('Error stack:', err.stack);
    
    res.status(500).send({
      message: "Une erreur est survenue lors de l'envoi de la demande.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};