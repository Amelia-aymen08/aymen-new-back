const crypto = require('crypto');
const { BatimatAfterRegistration } = require('../models');
const { notifyCrm, requestContext } = require('../services/crmWebhook');
const { COUNTRY_DIAL_CODES } = require('../data/countryDialCodes');
const { sendBadgeEmail } = require('../services/batimatAfterMailer');
const { VISIT_DAYS } = require('../services/batimatAfterBadge');

const E164_PATTERN = /^\+\d{8,15}$/;
const short = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

exports.createRegistration = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, countryCode, visitDay,
      newsletterOptIn, consent,
      pageUri: clientPageUri, pageName, qrCampaign, qrSource,
    } = req.body;

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !phone?.trim()) {
      return res.status(400).json({ message: 'Merci de renseigner tous les champs obligatoires.' });
    }
    if (!VISIT_DAYS[visitDay]) {
      return res.status(400).json({ message: 'Merci de choisir votre jour de visite.' });
    }
    if (consent !== true) {
      return res.status(400).json({ message: 'Vous devez accepter les conditions pour continuer.' });
    }

    const dial = COUNTRY_DIAL_CODES[countryCode];
    if (!dial) {
      return res.status(400).json({ message: "Merci de sélectionner l'indicatif téléphonique." });
    }
    const normalizedPhone = `${dial}${phone.replace(/[\s.\-()]/g, '').replace(/^0+/, '')}`;
    if (!E164_PATTERN.test(normalizedPhone)) {
      return res.status(400).json({ message: 'Le numéro de téléphone est invalide.' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await BatimatAfterRegistration.findOne({
      where: { email: normalizedEmail, phone: normalizedPhone },
    });
    if (existing) {
      return res.status(409).json({
        message: 'Une inscription avec cet e-mail et ce numéro existe déjà. Vérifiez votre boîte de réception (et vos courriers indésirables).',
      });
    }

    const ipAddress =
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    const registration = await BatimatAfterRegistration.create({
      firstName: firstName.trim().slice(0, 100),
      lastName: lastName.trim().slice(0, 100),
      email: normalizedEmail,
      phone: normalizedPhone,
      visitDay,
      newsletterOptIn: newsletterOptIn === true,
      consent: true,
      qrToken: crypto.randomBytes(16).toString('hex'),
      qrCampaign: short(qrCampaign, 60)?.toLowerCase() || null,
      qrSource: short(qrSource, 60),
      ipAddress,
    });

    notifyCrm('batimat_after', registration, requestContext(req, { pageUri: clientPageUri, pageName }));

    const mail = await sendBadgeEmail(registration);
    if (mail.sent) {
      await registration.update({ badgeSentAt: new Date() });
    }

    return res.status(201).json({
      id: registration.id,
      badgeSent: mail.sent,
      message: mail.sent
        ? 'Inscription confirmée. Votre badge vient de vous être envoyé par e-mail.'
        : 'Inscription enregistrée. Votre badge vous sera envoyé par e-mail très prochainement.',
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Une inscription avec cet e-mail et ce numéro existe déjà.' });
    }
    console.error('❌ [batimat-after] Error creating registration:', error);
    return res.status(500).json({ message: 'Une erreur est survenue. Veuillez réessayer.' });
  }
};

// Liste pour le dashboard interne (token partagé).
exports.getAll = async (req, res) => {
  try {
    const rows = await BatimatAfterRegistration.findAll({ order: [['created_at', 'DESC']] });
    return res.status(200).json(rows);
  } catch (error) {
    console.error('❌ [batimat-after] Error fetching registrations:', error);
    return res.status(500).json({ message: 'Erreur lors de la récupération des inscriptions.' });
  }
};

// Renvoie le badge (ex. e-mail tombé en spam ou SMTP en panne à l'inscription).
exports.resendBadge = async (req, res) => {
  try {
    const registration = await BatimatAfterRegistration.findByPk(req.params.id);
    if (!registration) return res.status(404).json({ message: 'Inscription introuvable.' });

    const mail = await sendBadgeEmail(registration);
    if (!mail.sent) {
      return res.status(502).json({ message: "L'envoi du badge a échoué.", reason: mail.reason });
    }
    await registration.update({ badgeSentAt: new Date() });
    return res.status(200).json({ message: 'Badge renvoyé.' });
  } catch (error) {
    console.error('❌ [batimat-after] Error resending badge:', error);
    return res.status(500).json({ message: "Erreur lors du renvoi du badge." });
  }
};
