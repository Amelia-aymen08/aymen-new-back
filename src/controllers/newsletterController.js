const db = require('../models');
const { trackLeadInHubspot } = require('../services/hubspotForms');

exports.subscribe = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Adresse email invalide.' });
    }

    const source = String(req.body?.source || 'footer').trim();

    const [, created] = await db.Newsletter.findOrCreate({
      where: { email },
      defaults: { email, source },
    });

    if (!created) {
      return res.status(200).json({ success: true, message: 'Vous êtes déjà inscrit à notre newsletter.' });
    }

    try {
      const pageUri = req.get('referer') || null;
      const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket?.remoteAddress || null;
      const userAgent = req.get('user-agent') || null;
      await trackLeadInHubspot({
        kind: 'newsletter',
        email,
        fullName: '',
        phone: '',
        message: `Inscription newsletter — source: ${source}`,
        pageUri,
        ipAddress,
        userAgent,
      });
    } catch (e) {
      console.warn('[HubSpot] newsletter failed:', e?.message);
    }

    return res.status(201).json({ success: true, message: 'Merci ! Vous êtes bien inscrit à notre newsletter.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Erreur lors de l'inscription.", error: error.message });
  }
};
