const { BatimatPreinscription } = require('../models');
const { buildMessage, trackLeadInHubspot } = require('../services/hubspotForms');

// Indicatifs pays acceptés côté serveur (doit rester cohérent avec le
// sélecteur du formulaire frontend).
const COUNTRY_CODES = {
  DZ: { dial: '+213', pattern: /^\+213[5-7]\d{8}$/ },
  FR: { dial: '+33', pattern: /^\+33[1-9]\d{8}$/ },
  TN: { dial: '+216', pattern: /^\+216\d{8}$/ },
  MA: { dial: '+212', pattern: /^\+212\d{9}$/ },
};

exports.createLead = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, countryCode, profile, newsletterOptIn, consent } = req.body;

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !phone?.trim()) {
      return res.status(400).json({ message: 'Le prénom, le nom, l\'email et le téléphone sont obligatoires.' });
    }

    if (consent !== true) {
      return res.status(400).json({ message: 'Vous devez accepter les conditions pour continuer.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const country = COUNTRY_CODES[countryCode] || COUNTRY_CODES.DZ;
    const localPhone = phone.replace(/\s+/g, '').replace(/^0/, '');
    const normalizedPhone = `${country.dial}${localPhone}`;
    if (!country.pattern.test(normalizedPhone)) {
      return res.status(400).json({ message: 'Le numéro de téléphone est invalide.' });
    }

    const existingLead = await BatimatPreinscription.findOne({
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

    const lead = await BatimatPreinscription.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      profile: profile?.trim() || null,
      newsletterOptIn: newsletterOptIn === true,
      consent: true,
      ipAddress,
    });

    try {
      const pageUri = req.get('referer') || null;
      const userAgent = req.get('user-agent') || null;
      await trackLeadInHubspot({
        kind: 'batimat_2026',
        email: normalizedEmail,
        phone: normalizedPhone,
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        message: buildMessage({
          title: 'Préinscription BATIMAT 2026',
          lines: [
            profile?.trim() ? `Profil: ${profile.trim()}` : null,
            `Newsletter: ${newsletterOptIn === true ? 'oui' : 'non'}`,
          ],
        }),
        pageUri,
        ipAddress,
        userAgent,
      });
    } catch (e) {
      console.warn('[HubSpot] batimat submit failed:', e?.message || e);
    }

    return res.status(201).json({
      message: 'Votre demande de préinscription a bien été reçue.',
      id: lead.id,
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        message: 'Une demande avec cet email et ce numéro existe déjà.',
      });
    }
    console.error('❌ [batimat] Error creating lead:', error);
    return res.status(500).json({
      message: 'Une erreur est survenue. Veuillez réessayer.',
      error: error.message,
    });
  }
};

exports.getAllLeads = async (req, res) => {
  try {
    const leads = await BatimatPreinscription.findAll({
      order: [['createdAt', 'DESC']],
    });
    return res.status(200).json(leads);
  } catch (error) {
    console.error('❌ [batimat] Error fetching leads:', error);
    return res.status(500).json({
      message: 'Erreur lors de la récupération des leads.',
      error: error.message,
    });
  }
};
