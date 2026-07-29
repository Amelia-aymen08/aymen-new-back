const { VisiteVirtuelleRdv } = require('../models');
const { buildMessage, trackLeadInHubspot } = require('../services/hubspotForms');

exports.createLead = async (req, res) => {
  try {
    const { fullName, email, phone, localisations, consent } = req.body;

    if (!fullName?.trim() || !email?.trim()) {
      return res.status(400).json({ message: 'Le nom et l\'email sont obligatoires.' });
    }

    if (consent !== true) {
      return res.status(400).json({ message: 'Vous devez accepter les conditions pour continuer.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    let normalizedPhone = null;
    if (phone?.trim()) {
      const localPhone = phone.replace(/\s+/g, '').replace(/^(?:\+?213)+/, '');
      normalizedPhone = `+213${localPhone.replace(/^0/, '')}`;
      if (!/^\+213[5-7]\d{8}$/.test(normalizedPhone)) {
        return res.status(400).json({ message: 'Le numéro de téléphone est invalide.' });
      }
    }

    const safeLocalisations = Array.isArray(localisations)
      ? localisations.filter((l) => typeof l === 'string' && l.trim()).map((l) => l.trim())
      : [];

    const existingLead = await VisiteVirtuelleRdv.findOne({
      where: { email: normalizedEmail, phone: normalizedPhone },
    });

    if (existingLead) {
      return res.status(409).json({
        message: 'Une demande avec cet email et ce numéro existe déjà.',
      });
    }

    const ipAddress =
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    const lead = await VisiteVirtuelleRdv.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      localisations: JSON.stringify(safeLocalisations),
      consent: true,
      ipAddress,
    });

    try {
      const pageUri = req.get('referer') || null;
      const userAgent = req.get('user-agent') || null;
      await trackLeadInHubspot({
        kind: 'visite_virtuelle_rdv',
        email: normalizedEmail,
        phone: normalizedPhone,
        fullName: fullName.trim(),
        message: buildMessage({
          title: 'Prendre Rendez-vous — Visite virtuelle',
          lines: [
            safeLocalisations.length ? `Localisation souhaitée: ${safeLocalisations.join(', ')}` : null,
          ],
        }),
        pageUri,
        ipAddress,
        userAgent,
      });
    } catch (e) {
      console.warn('[HubSpot] visite-virtuelle-rdv submit failed:', e?.message || e);
    }

    return res.status(201).json({
      message: 'Votre demande a bien été reçue. Un conseiller vous contactera très bientôt.',
      id: lead.id,
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        message: 'Une demande avec cet email et ce numéro existe déjà.',
      });
    }
    console.error('❌ [visite-virtuelle-rdv] Error creating lead:', error);
    return res.status(500).json({
      message: 'Une erreur est survenue. Veuillez réessayer.',
      error: error.message,
    });
  }
};

exports.getAllLeads = async (req, res) => {
  try {
    const leads = await VisiteVirtuelleRdv.findAll({
      order: [['createdAt', 'DESC']],
    });
    return res.status(200).json(leads);
  } catch (error) {
    console.error('❌ [visite-virtuelle-rdv] Error fetching leads:', error);
    return res.status(500).json({
      message: 'Erreur lors de la récupération des leads.',
      error: error.message,
    });
  }
};
