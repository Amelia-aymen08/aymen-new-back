const { HomeContact } = require('../models');

exports.createHomeContact = async (req, res) => {
  try {
    const { fullName, email, phone, message, consent } = req.body;
    const consentValue = consent === 'true' || consent === true;

    if (!fullName || !email || !phone || !message) {
      return res.status(400).json({ message: 'Champs requis manquants.' });
    }

    if (!consentValue) {
      return res.status(400).json({ message: 'Consentement requis.' });
    }

    const homeContact = await HomeContact.create({
      fullName,
      email,
      phone,
      message,
      consent: consentValue,
    });

    return res.status(201).json({
      message: 'Votre message a été envoyé avec succès.',
      homeContact,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Une erreur est survenue lors de l\'envoi du message.',
      error: error.message,
    });
  }
};

exports.getAllHomeContacts = async (req, res) => {
  try {
    const homeContacts = await HomeContact.findAll({
      order: [['createdAt', 'DESC']],
    });
    return res.status(200).json(homeContacts);
  } catch (error) {
    return res.status(500).json({
      message: 'Une erreur est survenue lors de la récupération des messages.',
      error: error.message,
    });
  }
};
