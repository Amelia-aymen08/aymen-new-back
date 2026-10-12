const { JpoHeleniteRegistration } = require('../models');
const { notifyCrm, requestContext } = require('../services/crmWebhook');
const { COUNTRY_DIAL_CODES } = require('../data/countryDialCodes');
const { sendConfirmationEmail } = require('../services/jpoHeleniteMailer');

const E164_PATTERN = /^\+\d{8,15}$/;
const short = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

// Journées portes ouvertes : du vendredi 23 au jeudi 29 octobre 2026.
// Vendredi : à partir de 15h (lancement). Samedi → jeudi : 08h - 18h.
const FRIDAY_SLOTS = ['15h - 16h', '16h - 17h', '17h - 18h', '18h - 19h'];
const DAY_SLOTS = [
  '08h - 09h', '09h - 10h', '10h - 11h', '11h - 12h', '12h - 13h',
  '13h - 14h', '14h - 15h', '15h - 16h', '16h - 17h', '17h - 18h',
];
const SLOTS_BY_DATE = {
  '2026-10-23': FRIDAY_SLOTS,
  '2026-10-24': DAY_SLOTS,
  '2026-10-25': DAY_SLOTS,
  '2026-10-26': DAY_SLOTS,
  '2026-10-27': DAY_SLOTS,
  '2026-10-28': DAY_SLOTS,
  '2026-10-29': DAY_SLOTS,
};

const PROFILES = ['Futur acquéreur', 'Investisseur', 'Projet familial', 'Diaspora / retour en Algérie', 'Autre'];
const TYPOLOGIES = ['À définir', 'F2', 'F3', 'F4', 'F5', 'Duplex / penthouse'];
const HORIZONS = ['Immédiat / moins de 3 mois', '3 à 6 mois', '6 à 12 mois', 'Plus de 12 mois'];

// Champ facultatif à liste fermée : vide → null, valeur inconnue → erreur.
const optionalChoice = (value, allowed) => {
  if (value === undefined || value === null || value === '') return { value: null };
  return allowed.includes(value) ? { value } : { error: true };
};

exports.createRegistration = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, countryCode, visitDate, timeSlot,
      profile, typology, horizon, message,
      newsletterOptIn, consent,
      pageUri: clientPageUri, pageName, qrCampaign, qrSource,
    } = req.body;

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !phone?.trim()) {
      return res.status(400).json({ message: 'Merci de renseigner tous les champs obligatoires.' });
    }
    if (!SLOTS_BY_DATE[visitDate]) {
      return res.status(400).json({ message: 'Merci de choisir votre jour de visite.' });
    }
    if (!SLOTS_BY_DATE[visitDate].includes(timeSlot)) {
      return res.status(400).json({ message: "Ce créneau n'est pas disponible pour le jour choisi." });
    }
    if (consent !== true) {
      return res.status(400).json({ message: 'Vous devez accepter les conditions pour continuer.' });
    }

    const profileChoice = optionalChoice(profile, PROFILES);
    const typologyChoice = optionalChoice(typology, TYPOLOGIES);
    const horizonChoice = optionalChoice(horizon, HORIZONS);
    if (profileChoice.error || typologyChoice.error || horizonChoice.error) {
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

    const existing = await JpoHeleniteRegistration.findOne({
      where: { email: normalizedEmail, phone: normalizedPhone },
    });
    if (existing) {
      return res.status(409).json({
        message: 'Une inscription avec cet e-mail et ce numéro existe déjà. Notre équipe vous contactera pour confirmer votre créneau.',
      });
    }

    const ipAddress =
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    const registration = await JpoHeleniteRegistration.create({
      firstName: firstName.trim().slice(0, 100),
      lastName: lastName.trim().slice(0, 100),
      email: normalizedEmail,
      phone: normalizedPhone,
      visitDate,
      timeSlot,
      profile: profileChoice.value,
      typology: typologyChoice.value,
      horizon: horizonChoice.value,
      message: short(message, 1500),
      newsletterOptIn: newsletterOptIn === true,
      consent: true,
      qrCampaign: short(qrCampaign, 60)?.toLowerCase() || null,
      qrSource: short(qrSource, 60),
      ipAddress,
    });

    notifyCrm('jpo_helenite', registration, requestContext(req, { pageUri: clientPageUri, pageName }));

    const mail = await sendConfirmationEmail(registration);

    return res.status(201).json({
      id: registration.id,
      confirmationSent: mail.sent,
      message: mail.sent
        ? 'Votre demande est bien enregistrée. Un e-mail de confirmation vient de vous être envoyé ; notre équipe vous contactera pour confirmer votre créneau et vous communiquer le lieu exact.'
        : 'Votre demande est bien enregistrée. Notre équipe vous contactera pour confirmer votre créneau et vous communiquer le lieu exact.',
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Une inscription avec cet e-mail et ce numéro existe déjà.' });
    }
    console.error('❌ [jpo-helenite] Error creating registration:', error);
    return res.status(500).json({ message: 'Une erreur est survenue. Veuillez réessayer.' });
  }
};

// Liste pour usage interne (token dashboard).
exports.getAll = async (req, res) => {
  try {
    const rows = await JpoHeleniteRegistration.findAll({
      attributes: { exclude: ['ipAddress'] },
      order: [['created_at', 'DESC']],
    });
    return res.status(200).json(rows);
  } catch (error) {
    console.error('❌ [jpo-helenite] Error fetching registrations:', error);
    return res.status(500).json({ message: 'Erreur lors de la récupération des inscriptions.' });
  }
};
