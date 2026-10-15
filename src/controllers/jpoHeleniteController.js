const { Op, fn, col } = require('sequelize');
const { JpoHeleniteRegistration, QrScan } = require('../models');
const { buildMessage, trackLeadInHubspot } = require('../services/hubspotForms');
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
      pageUri: clientPageUri, pageName, qrCampaign, qrSource, qrMedium,
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
      qrMedium: short(qrMedium, 60)?.toLowerCase() || null,
      ipAddress,
    });

    notifyCrm('jpo_helenite', registration, requestContext(req, { pageUri: clientPageUri, pageName }));

    // Même inscription envoyée au formulaire HubSpot de l'équipe marketing — en arrière-plan,
    // un échec HubSpot ne doit jamais faire échouer l'inscription.
    const hubspotCtx = requestContext(req, { pageUri: clientPageUri, pageName });
    trackLeadInHubspot({
      kind: 'jpo_helenite',
      email: registration.email,
      phone: registration.phone,
      phoneFieldNames: ['phone', 'mobilephone', 'phone_number'],
      firstName: registration.firstName,
      lastName: registration.lastName,
      message: buildMessage({
        title: 'Avant-première Résidence Hélénite (JPO)',
        lines: [
          `Téléphone: ${registration.phone}`,
          `Jour souhaité: ${registration.visitDate}`,
          `Créneau: ${registration.timeSlot}`,
          registration.profile && `Profil: ${registration.profile}`,
          registration.typology && `Typologie: ${registration.typology}`,
          registration.horizon && `Horizon: ${registration.horizon}`,
          registration.message && `Précision: ${registration.message}`,
          registration.qrSource && `Source: ${[registration.qrCampaign, registration.qrSource, registration.qrMedium].filter(Boolean).join(' / ')}`,
          `Newsletter: ${registration.newsletterOptIn ? 'oui' : 'non'}`,
        ],
      }),
      pageUri: hubspotCtx.pageUri,
      pageName: hubspotCtx.pageName,
      ipAddress: hubspotCtx.ipAddress,
      userAgent: hubspotCtx.userAgent,
      hutk: typeof req.body.hutk === 'string' ? req.body.hutk : undefined,
    }).catch((e) => console.warn('[HubSpot] jpo_helenite submit failed:', e?.message || e, e?.details || ''));

    const mail = await sendConfirmationEmail(registration);
    if (mail.sent) {
      await registration.update({ badgeSentAt: new Date() }).catch(() => {});
    }

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

const STATUSES = ['nouveau', 'confirme', 'annule'];

// Change le statut de suivi interne d'une inscription.
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Statut invalide.' });
    }
    const registration = await JpoHeleniteRegistration.findByPk(req.params.id);
    if (!registration) return res.status(404).json({ message: 'Inscription introuvable.' });
    await registration.update({ status });
    return res.status(200).json({ id: registration.id, status });
  } catch (error) {
    console.error('❌ [jpo-helenite] Error updating status:', error);
    return res.status(500).json({ message: 'Erreur lors de la mise à jour du statut.' });
  }
};

// Renvoie le badge (e-mail tombé en spam, SMTP en panne à l'inscription…).
exports.resendBadge = async (req, res) => {
  try {
    const registration = await JpoHeleniteRegistration.findByPk(req.params.id);
    if (!registration) return res.status(404).json({ message: 'Inscription introuvable.' });

    const mail = await sendConfirmationEmail(registration);
    if (!mail.sent) {
      return res.status(502).json({ message: "L'envoi du badge a échoué.", reason: mail.reason });
    }
    await registration.update({ badgeSentAt: new Date() });
    return res.status(200).json({ message: 'Badge renvoyé.' });
  } catch (error) {
    console.error('❌ [jpo-helenite] Error resending badge:', error);
    return res.status(500).json({ message: 'Erreur lors du renvoi du badge.' });
  }
};

// Visites des liens suivis (utm / /jpo_helenite/<source>) : table `qr_scans`, filtrée sur les
// pages /jpo_helenite*. Les inscriptions sont agrégées côté dashboard à partir de GET /.
exports.getLinkStats = async (req, res) => {
  try {
    const includeBots = String(req.query.includeBots || '') === '1';
    const where = { landingPath: { [Op.like]: '/jpo_helenite%' } };
    if (!includeBots) where.isBot = false;

    const links = await QrScan.findAll({
      where,
      attributes: [
        'campaign',
        'source',
        'medium',
        [fn('COUNT', col('id')), 'scans'],
        [fn('COUNT', fn('DISTINCT', col('visitor_id'))), 'uniques'],
        [fn('MAX', col('created_at')), 'lastScanAt'],
      ],
      group: ['campaign', 'source', 'medium'],
      raw: true,
    });

    // DATE_FORMAT : chaîne yyyy-mm-dd (un DATE() brut serait renvoyé comme objet Date, décalé par le fuseau).
    const dayExpr = fn('DATE_FORMAT', col('created_at'), '%Y-%m-%d');
    const daily = await QrScan.findAll({
      where,
      attributes: [[dayExpr, 'day'], [fn('COUNT', col('id')), 'scans']],
      group: [dayExpr],
      order: [[dayExpr, 'ASC']],
      raw: true,
    });

    return res.status(200).json({
      links: links.map((l) => ({
        campaign: l.campaign,
        source: l.source,
        medium: l.medium,
        scans: Number(l.scans) || 0,
        uniques: Number(l.uniques) || 0,
        lastScanAt: l.lastScanAt,
      })),
      daily: daily.map((d) => ({ day: d.day, scans: Number(d.scans) || 0 })),
    });
  } catch (error) {
    // Table qr_scans absente / mauvaise base : le dashboard reste utilisable sans les visites.
    console.warn('[jpo-helenite] link stats indisponibles:', error.original?.sqlMessage || error.message);
    return res.status(200).json({ links: [], daily: [], unavailable: true });
  }
};
