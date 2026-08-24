const { OffreEteLead } = require('../models');
const { buildMessage, trackLeadInHubspot } = require('../services/hubspotForms');

exports.createLead = async (req, res) => {
  try {
    const { fullName, email, phone, preference, hutk, pageUri: clientPageUri, pageName } = req.body;

    if (!fullName?.trim() || !email?.trim() || !phone?.trim() || !preference) {
      return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const localPhone = phone.replace(/\s+/g, '').replace(/^(?:\+?213)+/, '');
    const normalizedPhone = `+213${localPhone.replace(/^0/, '')}`;

    if (!/^\+213[5-7]\d{8}$/.test(normalizedPhone)) {
      return res.status(400).json({ message: 'Le num\u00e9ro de t\u00e9l\u00e9phone est invalide.' });
    }

    if (!['email', 'telephone', 'whatsapp'].includes(preference)) {
      return res.status(400).json({ message: 'La pr\u00e9f\u00e9rence de contact est invalide.' });
    }

    const existingLead = await OffreEteLead.findOne({
      where: { email: normalizedEmail, phone: normalizedPhone },
    });

    if (existingLead) {
      return res.status(409).json({
        message: 'Une demande avec cet email et ce num\u00e9ro existe d\u00e9j\u00e0.',
      });
    }

    const ipAddress =
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    const lead = await OffreEteLead.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      preference,
      ipAddress,
    });

    try {
      const pageUri = clientPageUri || req.get('referer') || null;
      const userAgent = req.get('user-agent') || null;
      await trackLeadInHubspot({
        kind: 'offres_ete',
        email: normalizedEmail,
        phone: normalizedPhone,
        fullName: fullName.trim(),
        message: buildMessage({
          title: 'Offres Été 2026',
          lines: [
            `Préférence de contact: ${preference || 'email'}`,
          ],
        }),
        pageUri,
        pageName,
        hutk,
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
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        message: 'Une demande avec cet email et ce num\u00e9ro existe d\u00e9j\u00e0.',
      });
    }
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
