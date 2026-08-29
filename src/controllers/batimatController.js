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
    const { firstName, lastName, email, phone, countryCode, profile, newsletterOptIn, consent, hutk, pageUri: clientPageUri, pageName, qrCampaign, qrSource } = req.body;

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !phone?.trim() || !profile?.trim()) {
      return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
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

    const basePayload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      profile: profile.trim(),
      newsletterOptIn: newsletterOptIn === true,
      consent: true,
      ipAddress,
    };
    const attributionPayload = {
      qrCampaign: typeof qrCampaign === 'string' && qrCampaign.trim() ? qrCampaign.trim().toLowerCase().slice(0, 60) : null,
      qrSource: typeof qrSource === 'string' && qrSource.trim() ? qrSource.trim().slice(0, 60) : null,
    };

    let lead;
    try {
      lead = await BatimatPreinscription.create({ ...basePayload, ...attributionPayload });
    } catch (e) {
      // Tolérance pendant la fenêtre de migration : si les colonnes qr_campaign /
      // qr_source n'existent pas encore, on enregistre quand même la préinscription.
      if (e.name === 'SequelizeDatabaseError' && /qr_campaign|qr_source|unknown column/i.test(e.message)) {
        console.warn('[batimat] colonnes attribution manquantes — préinscription enregistrée sans attribution.');
        lead = await BatimatPreinscription.create(basePayload, {
          fields: Object.keys(basePayload),
        });
      } else {
        throw e;
      }
    }

    try {
      const pageUri = clientPageUri || req.get('referer') || null;
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
        pageName,
        ipAddress,
        userAgent,
        hutk,
      });
    } catch (e) {
      console.warn('[HubSpot] batimat submit failed:', e?.message || e, e?.details ? `| details: ${e.details}` : '');
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

const VALID_STATUTS = ['nouveau', 'confirmé', 'annulé'];

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    if (!VALID_STATUTS.includes(statut)) {
      return res.status(400).json({ message: 'Statut invalide.' });
    }

    const lead = await BatimatPreinscription.findByPk(id);
    if (!lead) {
      return res.status(404).json({ message: 'Inscription introuvable.' });
    }

    await lead.update({ statut });
    await lead.reload();

    // Filet de sécurité : si la colonne `statut` est encore un ENUM MySQL dont
    // les valeurs ne correspondent pas (migration non exécutée), MySQL en mode
    // non strict stocke '' silencieusement. On le détecte pour ne pas laisser
    // le dashboard croire que la mise à jour a réussi.
    if (lead.statut !== statut) {
      return res.status(500).json({
        message: "La base de données a rejeté ce statut. La colonne 'statut' doit être migrée (voir backend/sql/fix_batimat_statut.sql).",
      });
    }

    return res.status(200).json(lead);
  } catch (error) {
    console.error('❌ [batimat] Error updating status:', error);
    return res.status(500).json({
      message: 'Erreur lors de la mise à jour du statut.',
      error: error.message,
    });
  }
};

exports.getAllLeads = async (req, res) => {
  try {
    const leads = await BatimatPreinscription.findAll({
      order: [['created_at', 'DESC']],
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
