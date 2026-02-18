const db = require('../models');
const Contact = db.Contact;

exports.createContact = async (req, res) => {
  try {
    const { fullName, email, phone, subject, message, type } = req.body;

    const contact = await Contact.create({
      fullName,
      email,
      phone,
      subject,
      message,
      type: type || 'contact',
    });

    res.status(201).json({
      message: 'Votre message a été envoyé avec succès.',
      contact,
    });
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({
      message: 'Une erreur est survenue lors de l\'envoi du message.',
      error: error.message,
    });
  }
};

exports.getAllContacts = async (req, res) => {
  try {
    const contacts = await Contact.findAll({
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({
      message: 'Une erreur est survenue lors de la récupération des messages.',
      error: error.message,
    });
  }
};
