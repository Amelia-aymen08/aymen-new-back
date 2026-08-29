// Auth simple par token partagé pour les dashboards internes (BATIMAT, tracking QR).
// Le token est envoyé soit en `Authorization: Bearer <token>`, soit en `x-api-key`.
module.exports = function requireDashboardToken(envVarNames = ['BATIMAT_DASHBOARD_TOKEN']) {
  const names = Array.isArray(envVarNames) ? envVarNames : [envVarNames];

  return function (req, res, next) {
    const expected = names
      .map((n) => process.env[n])
      .find((v) => typeof v === 'string' && v.trim());

    if (!expected) {
      return res.status(503).json({ message: 'Accès dashboard non configuré.' });
    }

    const authHeader = req.get('authorization') || '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const apiKey = String(req.get('x-api-key') || '').trim();
    const provided = (bearer || apiKey).trim();

    if (!provided || provided !== String(expected).trim()) {
      return res.status(401).json({ message: 'Authentification dashboard requise.' });
    }

    return next();
  };
};
