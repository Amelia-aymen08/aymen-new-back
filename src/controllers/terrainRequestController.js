const db = require('../models');
const { buildMessage, trackLeadInHubspot } = require('../services/hubspotForms');

const createTerrainRequest = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      subject,
      landAddress,
      facade,
      area,
      papers,
      consent,
    } = req.body;

    if (!firstName || !lastName || !email || !phone || !landAddress) {
      return res.status(400).json({
        success: false,
        message: "Les champs obligatoires doivent être remplis.",
      });
    }

    if (!db.TerrainRequest) {
      return res.status(500).json({
        success: false,
        message: "Erreur de configuration serveur.",
      });
    }

    const paperEntries =
      papers && typeof papers === 'object' && !Array.isArray(papers)
        ? Object.entries(papers)
            .filter(([, value]) => Boolean(value))
            .map(([key]) => key)
        : Array.isArray(papers)
          ? papers
          : [];

    const terrainRequest = await db.TerrainRequest.create({
      firstName,
      lastName,
      email,
      phone,
      subject: subject || null,
      landAddress,
      facade: facade || null,
      area: area || null,
      papers: paperEntries.length ? JSON.stringify(paperEntries) : null,
      consent: consent === true || consent === 'true',
    });

    try {
      const pageUri = req.get('referer') || null;
      const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket?.remoteAddress || null;
      const userAgent = req.get('user-agent') || null;
      await trackLeadInHubspot({
        kind: 'contact',
        email,
        phone,
        fullName: `${firstName} ${lastName}`.trim(),
        message: buildMessage({
          title: 'Demande terrain',
          lines: [
            subject ? `Objet: ${subject}` : '',
            landAddress ? `Adresse du terrain: ${landAddress}` : '',
            facade ? `Façade: ${facade}` : '',
            area ? `Superficie: ${area}` : '',
            paperEntries.length ? `Documents: ${paperEntries.join(', ')}` : '',
            consent === true || consent === 'true' ? 'Consentement: Oui' : 'Consentement: Non',
          ],
        }),
        pageUri,
        ipAddress,
        userAgent,
      });
    } catch (e) {
      console.warn('[HubSpot] terrain submit failed:', e?.message || e);
    }

    res.status(201).json({
      success: true,
      message: "Votre demande terrain a été envoyée avec succès.",
      data: terrainRequest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de l'envoi de votre demande.",
      error: error.message,
    });
  }
};

const findAll = async (req, res) => {
  try {
    const data = await db.TerrainRequest.findAll({
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de la récupération des demandes terrain.",
      error: error.message,
    });
  }
};

module.exports = {
  createTerrainRequest,
  findAll,
};
