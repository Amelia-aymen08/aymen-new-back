// controllers/quoteController.js
const db = require('../models');
const { buildMessage, trackLeadInHubspot } = require('../services/hubspotForms');

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

    try {
      const pageUri = req.get('referer') || null;
      const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket?.remoteAddress || null;
      const userAgent = req.get('user-agent') || null;
      await trackLeadInHubspot({
        kind: 'quote',
        email,
        phone,
        fullName: `${firstName || ''} ${lastName || ''}`.trim(),
        message: buildMessage({
          title: 'Devis',
          lines: [
            sourceProject ? `Projet: ${sourceProject}` : '',
            country ? `Pays: ${country}` : '',
            wilaya ? `Wilaya: ${wilaya}` : '',
            budget ? `Budget: ${budget}` : '',
            profession ? `Profession: ${profession}` : '',
            financing ? `Financement: ${financing}` : '',
            interest ? `Intérêt: ${interest}` : '',
            Array.isArray(locations) ? `Localisations: ${locations.join(', ')}` : locations ? `Localisations: ${locations}` : '',
            Array.isArray(contactDays) ? `Jours contact: ${contactDays.join(', ')}` : contactDays ? `Jours contact: ${contactDays}` : '',
            contactTime ? `Heure contact: ${contactTime}` : '',
            projectStatus ? `Statut projet: ${projectStatus}` : '',
            consent === 'true' || consent === true ? 'Consentement: Oui' : 'Consentement: Non',
          ],
        }),
        pageUri,
        ipAddress,
        userAgent,
      });
    } catch (e) {
      console.warn('[HubSpot] quote submit failed:', e?.message || e);
    }
    
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
