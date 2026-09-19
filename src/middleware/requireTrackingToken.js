// Auth du dashboard de suivi QR, avec périmètre par token.
//
//  - TRACKING_DASHBOARD_TOKEN / BATIMAT_DASHBOARD_TOKEN  -> voit TOUTES les campagnes
//  - TRACKING_TOKEN_FLYER                                -> voit uniquement "flyer"
//  - TRACKING_TOKEN_BATIMAT                              -> voit "batimat-bache" et "batimat"
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
    // "batimat" = liens nommés /batimat/<slug> (le slug est stocké dans `source`) ;
    // "batimat-bache" = QR figé de la bâche. Même responsable, même token.
    const scoped = [
      { campaigns: ['flyer'], token: env('TRACKING_TOKEN_FLYER') },
      { campaigns: ['batimat-bache', 'batimat'], token: env('TRACKING_TOKEN_BATIMAT') },
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

    const allowed = scoped.filter((s) => s.token === provided).flatMap((s) => s.campaigns);
    if (allowed.length) {
      req.trackingScope = { all: false, campaigns: allowed };
      return next();
    }

    return res.status(401).json({ message: 'Authentification dashboard requise.' });
  };
};
