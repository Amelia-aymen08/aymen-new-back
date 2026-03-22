// quoteController.js
const db = require('../models');

const createQuote = async (req, res) => {
  // On importe les modèles
  const Quote = db.Quote;
  
  if (!Quote) {
    return res.status(500).send({
      message: "Le modèle 'Quote' n'est pas chargé dans l'application backend.",
      dbModels: Object.keys(db)
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

    const data = await Quote.create(quoteData);
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
    const data = await db.Quote.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.send(data);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Une erreur est survenue lors de la récupération des devis."
    });
  }
};

module.exports = {
  createQuote,
  findAll
};