const { Op, fn, col } = require('sequelize');
const { QrScan, BatimatPreinscription } = require('../models');

const BOT_UA_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegrambot|embedly|quora link|pinterest|vkshare|redditbot|applebot|bingpreview|curl\/|wget\/|python-requests|headless|lighthouse|gtmetrix|pingdom|uptimerobot/i;

function clientIp(req) {
  return (
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

function clean(value, max) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, max);
}

// POST /api/track/scan  (public)
// Enregistre une arrivée via QR code / lien tracké.
exports.recordScan = async (req, res) => {
  try {
    const body = req.body || {};
    const campaign = clean(body.campaign, 60);
    if (!campaign) {
      return res.status(400).json({ message: 'campaign requis.' });
    }

    const userAgent = clean(req.get('user-agent'), 500);
    const isBot = userAgent ? BOT_UA_RE.test(userAgent) : false;

    await QrScan.create({
      campaign: campaign.toLowerCase(),
      source: clean(body.source, 60),
      medium: clean(body.medium, 60),
      landingPath: clean(body.landingPath || body.path, 255),
      referrer: clean(body.referrer, 255),
      userAgent,
      ipAddress: clean(clientIp(req), 45),
      visitorId: clean(body.visitorId, 40),
      isBot,
      isHeuristic: body.heuristic === true,
    });

    // Réponse volontairement minimale et rapide (appel non bloquant côté client).
    return res.status(204).end();
  } catch (error) {
    console.error('❌ [track] recordScan:', error.message);
    // On ne casse jamais l'expérience visiteur pour un échec de tracking.
    return res.status(204).end();
  }
};

// GET /api/track/stats?days=30  (protégé — token dashboard)
exports.getStats = async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    const since = new Date(Date.now() - days * 86400000);
    const includeBots = String(req.query.includeBots || '') === '1';

    const where = { createdAt: { [Op.gte]: since } };
    if (!includeBots) where.isBot = false;

    // Périmètre imposé par le token + éventuel ?campaign= plus restrictif.
    const scope = req.trackingScope || { all: true, campaigns: null };
    let campaignFilter = scope.all ? null : scope.campaigns;
    const requested = clean(req.query.campaign, 60);
    if (requested) {
      const rc = requested.toLowerCase();
      if (scope.all || (scope.campaigns || []).includes(rc)) {
        campaignFilter = [rc];
      } else {
        return res.status(403).json({ message: 'Campagne non autorisée pour ce token.' });
      }
    }
    if (campaignFilter) where.campaign = { [Op.in]: campaignFilter };

    let byCampaignRows;
    let dailyRows;
    try {
      // Totaux par campagne : scans + visiteurs uniques.
      byCampaignRows = await QrScan.findAll({
        where,
        attributes: [
          'campaign',
          [fn('COUNT', col('id')), 'scans'],
          [fn('COUNT', fn('DISTINCT', col('visitor_id'))), 'uniques'],
          [fn('SUM', col('is_heuristic')), 'heuristicScans'],
          [fn('MAX', col('created_at')), 'lastScanAt'],
        ],
        group: ['campaign'],
        raw: true,
      });

      // Série journalière (toutes campagnes confondues + détail par campagne).
      dailyRows = await QrScan.findAll({
        where,
        attributes: [
          [fn('DATE', col('created_at')), 'day'],
          'campaign',
          [fn('COUNT', col('id')), 'scans'],
        ],
        group: [fn('DATE', col('created_at')), 'campaign'],
        raw: true,
      });
    } catch (e) {
      // Table `qr_scans` ou colonne `is_heuristic` absente : migration non faite.
      if (e.name === 'SequelizeDatabaseError' && /doesn'?t exist|unknown column|no such table/i.test(e.message)) {
        console.warn('[track] getStats : migration manquante —', e.message);
        return res.status(200).json({
          rangeDays: days,
          since,
          needsMigration: true,
          totals: { scans: 0, uniques: 0, conversions: 0, campaigns: 0 },
          byCampaign: [],
          daily: [],
        });
      }
      throw e;
    }

    // Conversions BATIMAT attribuées à une campagne QR.
    // Resté tolérant tant que la colonne `qr_campaign` n'a pas été ajoutée
    // (voir backend/sql/qr_tracking.sql) : on renvoie simplement 0 conversion.
    const conversionsByCampaign = {};
    try {
      const conversionRows = await BatimatPreinscription.findAll({
        where: {
          qrCampaign: campaignFilter ? { [Op.in]: campaignFilter } : { [Op.ne]: null },
          createdAt: { [Op.gte]: since },
        },
        attributes: ['qrCampaign', [fn('COUNT', col('id')), 'conversions']],
        group: ['qrCampaign'],
        raw: true,
      });
      conversionRows.forEach((r) => {
        conversionsByCampaign[String(r.qrCampaign).toLowerCase()] = Number(r.conversions);
      });
    } catch (e) {
      console.warn('[track] conversions indisponibles (colonne qr_campaign manquante ?):', e.message);
    }

    const byCampaign = byCampaignRows.sort((a, b) => Number(b.scans) - Number(a.scans)).map((r) => {
      const scans = Number(r.scans);
      const heuristicScans = Number(r.heuristicScans || 0);
      const conversions = conversionsByCampaign[r.campaign] || 0;
      return {
        campaign: r.campaign,
        scans,
        uniques: Number(r.uniques),
        conversions,
        conversionRate: scans ? Math.round((conversions / scans) * 1000) / 10 : 0,
        // "estimation" si tous les scans de la campagne sont déduits (QR figé).
        estimated: scans > 0 && heuristicScans === scans,
        lastScanAt: r.lastScanAt,
      };
    });

    const uniqueRows = await QrScan.findAll({
      where,
      attributes: [[fn('COUNT', fn('DISTINCT', col('visitor_id'))), 'uniques']],
      raw: true,
    });

    const totals = {
      scans: byCampaign.reduce((s, c) => s + c.scans, 0),
      uniques: Number(uniqueRows[0]?.uniques || 0),
      conversions: Object.values(conversionsByCampaign).reduce((s, n) => s + n, 0),
      campaigns: byCampaign.length,
    };

    return res.status(200).json({
      rangeDays: days,
      since,
      totals,
      byCampaign,
      daily: dailyRows.map((r) => ({
        day: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10),
        campaign: r.campaign,
        scans: Number(r.scans),
      })),
    });
  } catch (error) {
    console.error('❌ [track] getStats:', error);
    return res.status(500).json({ message: 'Erreur lors du calcul des statistiques.', error: error.message });
  }
};
