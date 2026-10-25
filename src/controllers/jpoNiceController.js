const crypto = require('crypto');
const { JpoNiceRegistration } = require('../models');
const { notifyCrm, requestContext } = require('../services/crmWebhook');
const { COUNTRY_DIAL_CODES } = require('../data/countryDialCodes');
const { sendBadgeEmail } = require('../services/jpoNiceMailer');

const E164_PATTERN = /^\+\d{8,15}$/;
const short = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

// Listes fermées du formulaire (mêmes libellés que la page /jpo_nice).
const VISIT_DAYS = ['samedi', 'dimanche', 'flexible'];
const TIME_PREFS = ['matin', 'apres_midi', 'flexible', 'a_confirmer'];
const PROFILES = ['Futur acquéreur', 'Investisseur', 'Projet familial', 'Diaspora / retour en Algérie', 'Autre'];
const OBJECTIVES = ['Résidence principale', 'Résidence secondaire', 'Investissement locatif', 'Patrimoine familial', 'Découvrir les projets'];
const TYPOLOGIES = ['F2', 'F3', 'F4', 'F5', 'Duplex / penthouse'];
const HORIZONS = ['Immédiat / moins de 3 mois', '3 à 6 mois', '6 à 12 mois', 'Plus de 12 mois'];

// Champ facultatif à liste fermée : vide ou « À définir » → null, valeur inconnue → erreur.
const optionalChoice = (value, allowed) => {
  if (value === undefined || value === null || value === '' || value === 'À définir') return { value: null };
  return allowed.includes(value) ? { value } : { error: true };
};

exports.createRegistration = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, countryCode, visitDay, timePref,
      residenceCountry, city, profile, objective, typology, horizon, message,
      newsletterOptIn, consent,
      pageUri: clientPageUri, pageName, qrCampaign, qrSource, qrMedium,
    } = req.body;

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !phone?.trim()) {
      return res.status(400).json({ message: 'Merci de renseigner tous les champs obligatoires.' });
    }
    if (!VISIT_DAYS.includes(visitDay)) {
      return res.status(400).json({ message: 'Merci de choisir votre jour de visite.' });
    }
    const timeChoice = timePref || 'a_confirmer';
    if (!TIME_PREFS.includes(timeChoice)) {
      return res.status(400).json({ message: 'Merci de choisir votre préférence horaire.' });
    }
    if (consent !== true) {
      return res.status(400).json({ message: 'Vous devez accepter les conditions pour continuer.' });
    }

    const profileChoice = optionalChoice(profile, PROFILES);
    const objectiveChoice = optionalChoice(objective, OBJECTIVES);
    const typologyChoice = optionalChoice(typology, TYPOLOGIES);
    const horizonChoice = optionalChoice(horizon, HORIZONS);
    if (profileChoice.error || objectiveChoice.error || typologyChoice.error || horizonChoice.error) {
      return res.status(400).json({ message: 'Une des précisions sur votre projet est invalide.' });
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

    const existing = await JpoNiceRegistration.findOne({ where: { email: normalizedEmail, phone: normalizedPhone } });
    if (existing) {
      return res.status(409).json({
        message: 'Une inscription avec cet e-mail et ce numéro existe déjà. Vérifiez votre boîte de réception (et vos courriers indésirables).',
      });
    }

    const ipAddress =
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket?.remoteAddress || null;

    const registration = await JpoNiceRegistration.create({
      firstName: firstName.trim().slice(0, 100),
      lastName: lastName.trim().slice(0, 100),
      email: normalizedEmail,
      phone: normalizedPhone,
      visitDay,
      timePref: timeChoice,
      residenceCountry: short(residenceCountry, 100),
      city: short(city, 100),
      profile: profileChoice.value,
      objective: objectiveChoice.value,
      typology: typologyChoice.value,
      horizon: horizonChoice.value,
      message: short(message, 1500),
      newsletterOptIn: newsletterOptIn === true,
      consent: true,
      qrToken: crypto.randomBytes(16).toString('hex'),
      qrCampaign: short(qrCampaign, 60)?.toLowerCase() || null,
      qrSource: short(qrSource, 60),
      qrMedium: short(qrMedium, 60)?.toLowerCase() || null,
      ipAddress,
    });

    notifyCrm('jpo_nice', registration, requestContext(req, { pageUri: clientPageUri, pageName }));

    const mail = await sendBadgeEmail(registration);
    if (mail.sent) {
      await registration.update({ badgeSentAt: new Date() }).catch(() => {});
    }

    return res.status(201).json({
      id: registration.id,
      badgeSent: mail.sent,
      message: mail.sent
        ? 'Inscription enregistrée. Votre badge nominatif vient de vous être envoyé par e-mail.'
        : 'Inscription enregistrée. Votre badge vous sera envoyé par e-mail très prochainement.',
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Une inscription avec cet e-mail et ce numéro existe déjà.' });
    }
    console.error('❌ [jpo-nice] Error creating registration:', error);
    return res.status(500).json({ message: 'Une erreur est survenue. Veuillez réessayer.' });
  }
};

// Liste pour usage interne (token dashboard). Le jeton du QR code et l'IP ne sortent pas de la base.
exports.getAll = async (req, res) => {
  try {
    const rows = await JpoNiceRegistration.findAll({
      attributes: { exclude: ['qrToken', 'ipAddress'] },
      order: [['created_at', 'DESC']],
    });
    return res.status(200).json(rows);
  } catch (error) {
    console.error('❌ [jpo-nice] Error fetching registrations:', error);
    return res.status(500).json({ message: 'Erreur lors de la récupération des inscriptions.' });
  }
};

// Renvoie le badge (e-mail tombé en spam, SMTP en panne à l'inscription…).
exports.resendBadge = async (req, res) => {
  try {
    const registration = await JpoNiceRegistration.findByPk(Number(req.params.id));
    if (!registration) return res.status(404).json({ message: 'Inscription introuvable.' });
    const mail = await sendBadgeEmail(registration);
    if (!mail.sent) {
      return res.status(502).json({ message: "L'envoi du badge a échoué.", reason: mail.reason });
    }
    await registration.update({ badgeSentAt: new Date() });
    return res.status(200).json({ message: 'Badge renvoyé.' });
  } catch (error) {
    console.error('❌ [jpo-nice] Error resending badge:', error);
    return res.status(500).json({ message: 'Erreur lors du renvoi du badge.' });
  }
};
