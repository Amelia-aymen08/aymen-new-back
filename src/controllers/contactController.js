const db = require('../models');
const { Contact } = require('../models');
const fs = require('fs');
const path = require('path');

exports.createContact = async (req, res) => {
  console.log("🚀 [CONTROLLER] createContact appelé !");
  try {
    const { fullName, email, phone, subject, message, type, consent, attachmentData, attachmentName } = req.body;
    console.log("📦 Données extraites:", { fullName, email, phone, subject, message, type, consent, hasAttachment: !!attachmentData });
    
    let attachmentPath = null;

    // Si on a reçu un fichier en Base64, on le sauvegarde sur le disque
    if (attachmentData && attachmentName) {
      // Extraire le type mime et les données (ex: "data:image/png;base64,iVBORw0KGgo...")
      const matches = attachmentData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      
      if (matches && matches.length === 3) {
        const fileBuffer = Buffer.from(matches[2], 'base64');
        const uploadDir = path.join(__dirname, '../../uploads/contacts');
        
        // Créer le dossier s'il n'existe pas
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `${Date.now()}-${attachmentName.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const filePath = path.join(uploadDir, fileName);
        
        fs.writeFileSync(filePath, fileBuffer);
        attachmentPath = `uploads/contacts/${fileName}`;
      }
    }

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
