const db = require('../models');
const { Contact } = require('../models');
const { buildMessage, trackLeadInHubspot } = require('../services/hubspotForms');

exports.createContact = async (req, res) => {
  console.log("🚀 [CONTROLLER] createContact appelé !");
  try {
    const { fullName, email, phone, subject, message, type, consent } = req.body;
    console.log("📦 Données extraites:", { fullName, email, phone, subject, message, type, consent });
    
    // Multer a placé le fichier sur le disque et a rempli req.file
    const attachmentPath = req.file ? req.file.path : null;

    const contact = await Contact.create({
      fullName,
      email,
      phone,
      subject,
      message,
      type: type || 'contact',
      attachment: attachmentPath,
      consent: consent === 'true' || consent === true
    });

    try {
      const pageUri = req.get('referer') || null;
      const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket?.remoteAddress || null;
      const userAgent = req.get('user-agent') || null;
      await trackLeadInHubspot({
        kind: 'contact',
        email,
        phone,
        fullName,
        message: buildMessage({
          title: 'Contact',
          lines: [
            subject ? `Objet: ${subject}` : '',
            type ? `Type: ${type}` : '',
            message || '',
            req.file?.originalname ? `Pièce jointe: ${req.file.originalname}` : '',
          ],
        }),
        pageUri,
        ipAddress,
        userAgent,
      });
    } catch (e) {
      console.warn('[HubSpot] contact submit failed:', e?.message || e);
    }

    console.log("✅ [CONTROLLER] Contact enregistré en BDD avec succès ! ID:", contact.id);
    res.status(201).json({
      message: 'Votre message a été envoyé avec succès.',
      contact,
    });
  } catch (error) {
    console.error('❌ [CONTROLLER ERROR] Error creating contact:', error);
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
