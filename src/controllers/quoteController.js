const db = require('../models');

exports.createQuote = async (req, res) => {
  const db = require('../models');
  const Quote = db.Quote;
  
  console.log('API Request received at /api/quotes');
  console.log('Available models in DB:', Object.keys(db));
  
  if (!Quote) {
    console.error('ERROR: Quote model is undefined in controller!');
    return res.status(500).send({
      message: "Erreur serveur : Le modèle Quote n'est pas chargé.",
      debug: {
        dbKeys: Object.keys(db)
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

    // Basic validation
    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).send({
        message: "Les champs obligatoires (Nom, Prénom, Email, Téléphone) doivent être remplis !"
      });
    }

    const quote = {
      email,
      firstName,
      lastName,
      phone,
      country,
      wilaya,
      budget,
      profession,
      financing,
      interest,
      locations, // Expecting array or string
      contactDays, // Expecting array or string
      contactTime,
      projectStatus,
      consent: consent === 'true' || consent === true,
      sourceProject
    };

    const data = await Quote.create(quote);
    res.status(201).send({
      message: "Votre demande de devis a été envoyée avec succès !",
      data: data
    });
  } catch (err) {
    console.error('Error creating quote:', err);
    res.status(500).send({
      message: err.message || "Une erreur est survenue lors de l'envoi de la demande."
    });
  }
};

exports.findAll = async (req, res) => {
  try {
    const data = await Quote.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.send(data);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Une erreur est survenue lors de la récupération des devis."
    });
  }
};
