// Auth du dashboard de suivi QR, avec périmètre par token.
//
//  - TRACKING_DASHBOARD_TOKEN / BATIMAT_DASHBOARD_TOKEN  -> voit TOUTES les campagnes
//  - TRACKING_TOKEN_FLYER                                -> voit uniquement "flyer"
//  - TRACKING_TOKEN_BATIMAT                              -> voit uniquement "batimat-bache"
//
// Le périmètre est posé sur req.trackingScope = { all: bool, campaigns: string[]|null }.
module.exports = function requireTrackingToken() {
  const env = (n) => String(process.env[n] || '').trim();

  return function (req, res, next) {
    const authHeader = req.get('authorization') || '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const provided = (bearer || String(req.get('x-api-key') || '').trim()).trim();

    const masters = [env('TRACKING_DASHBOARD_TOKEN'), env('BATIMAT_DASHBOARD_TOKEN')].filter(Boolean);
    const scoped = [
      { campaign: 'flyer', token: env('TRACKING_TOKEN_FLYER') },
      { campaign: 'batimat-bache', token: env('TRACKING_TOKEN_BATIMAT') },
    ].filter((s) => s.token);

    if (!masters.length && !scoped.length) {
      return res.status(503).json({ message: 'Accès dashboard non configuré.' });
    }
    if (!provided) {
      return res.status(401).json({ message: 'Authentification dashboard requise.' });
    }

    if (masters.includes(provided)) {
      req.trackingScope = { all: true, campaigns: null };
      return next();
    }

    const allowed = scoped.filter((s) => s.token === provided).map((s) => s.campaign);
    if (allowed.length) {
      req.trackingScope = { all: false, campaigns: allowed };
      return next();
    }

    return res.status(401).json({ message: 'Authentification dashboard requise.' });
  };
};
