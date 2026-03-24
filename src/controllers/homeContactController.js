const { HomeContact } = require('../models');
const { buildMessage, trackLeadInHubspot } = require('../services/hubspotForms');

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

    try {
      const pageUri = req.get('referer') || null;
      const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket?.remoteAddress || null;
      const userAgent = req.get('user-agent') || null;
      await trackLeadInHubspot({
        kind: 'home',
        email,
        phone,
        fullName,
        message: buildMessage({
          title: 'Home contact',
          lines: [message],
        }),
        pageUri,
        ipAddress,
        userAgent,
      });
    } catch (e) {
      console.warn('[HubSpot] home submit failed:', e?.message || e);
    }

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
