const { OffreEteLead } = require('../models');
const { buildMessage, trackLeadInHubspot } = require('../services/hubspotForms');

exports.createLead = async (req, res) => {
  try {
    const { fullName, email, phone, preference } = req.body;

    if (!fullName || !email) {
      return res.status(400).json({ message: 'Nom et email sont obligatoires.' });
    }

    const ipAddress =
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    const lead = await OffreEteLead.create({
      fullName,
      email,
      phone: phone || null,
      preference: preference || 'email',
      ipAddress,
    });

    try {
      const pageUri = req.get('referer') || null;
      const userAgent = req.get('user-agent') || null;
      await trackLeadInHubspot({
        kind: 'offres_ete',
        email,
        phone,
        fullName,
        message: buildMessage({
          title: 'Offres Été 2026',
          lines: [
            `Préférence de contact: ${preference || 'email'}`,
          ],
        }),
        pageUri,
        ipAddress,
        userAgent,
      });
    } catch (e) {
      console.warn('[HubSpot] offres-ete submit failed:', e?.message || e);
    }

    return res.status(201).json({
      message: 'Votre demande a bien été reçue. Un conseiller vous contactera très bientôt.',
      id: lead.id,
    });
  } catch (error) {
    console.error('❌ [offres-ete] Error creating lead:', error);
    return res.status(500).json({
      message: 'Une erreur est survenue. Veuillez réessayer.',
      error: error.message,
    });
  }
};

exports.getAllLeads = async (req, res) => {
  try {
    const leads = await OffreEteLead.findAll({
      order: [['createdAt', 'DESC']],
    });
    return res.status(200).json(leads);
  } catch (error) {
    console.error('❌ [offres-ete] Error fetching leads:', error);
    return res.status(500).json({
      message: 'Erreur lors de la récupération des leads.',
      error: error.message,
    });
  }
};
