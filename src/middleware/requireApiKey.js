module.exports = function requireApiKey(options = {}) {
  const headerName = (options.headerName || 'x-api-key').toLowerCase();
  const envVarName = options.envVarName || 'CONCOURS_API_KEY';

  return function (req, res, next) {
    const expected = process.env[envVarName];
    if (!expected) {
      return res.status(500).json({
        success: false,
        message: 'API key non configurée côté serveur.',
      });
    }

    const provided =
      req.get(headerName) ||
      (() => {
        const auth = req.get('authorization') || '';
        const [scheme, token] = auth.split(' ');
        if (scheme?.toLowerCase() === 'bearer' && token) return token;
        return '';
      })();

    if (!provided || provided !== expected) {
      return res.status(401).json({ success: false, message: 'Clé API invalide.' });
    }

    return next();
  };
};

