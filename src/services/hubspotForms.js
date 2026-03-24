const https = require('https');

function getEnv(name) {
  const v = process.env[name];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function splitFullName(fullName) {
  const value = typeof fullName === 'string' ? fullName.trim() : '';
  if (!value) return { firstName: '', lastName: '' };
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function buildMessage({ title, lines }) {
  const safeLines = (Array.isArray(lines) ? lines : [])
    .map((l) => (typeof l === 'string' ? l.trim() : ''))
    .filter(Boolean);
  if (!safeLines.length) return title ? String(title) : '';
  return [title ? String(title) : null, ...safeLines].filter(Boolean).join('\n');
}

function resolveHubspotFormGuid(kind) {
  const k = typeof kind === 'string' ? kind.toUpperCase() : '';
  return (
    getEnv(`HUBSPOT_FORM_GUID_${k}`) ||
    getEnv('HUBSPOT_FORM_GUID') ||
    null
  );
}

function submitToHubspotForm({ portalId, formGuid, fields, context }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      fields,
      context,
    });

    const req = https.request(
      {
        method: 'POST',
        hostname: 'api.hsforms.com',
        path: `/submissions/v3/integration/submit/${encodeURIComponent(portalId)}/${encodeURIComponent(formGuid)}`,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 6500,
      },
      (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) return resolve();
          const err = new Error(`HubSpot form submit failed (${res.statusCode})`);
          err.details = raw;
          return reject(err);
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('HubSpot request timeout'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function trackLeadInHubspot({ kind, email, phone, fullName, message, pageUri, ipAddress, userAgent }) {
  const portalId = getEnv('HUBSPOT_PORTAL_ID');
  const formGuid = resolveHubspotFormGuid(kind);
  if (!portalId || !formGuid) return { sent: false, reason: 'missing_config' };

  const { firstName, lastName } = splitFullName(fullName);
  const fields = [
    email ? { name: 'email', value: email } : null,
    phone ? { name: 'phone', value: phone } : null,
    firstName ? { name: 'firstname', value: firstName } : null,
    lastName ? { name: 'lastname', value: lastName } : null,
    message ? { name: 'message', value: message } : null,
  ].filter(Boolean);

  const context = {
    pageUri: pageUri || undefined,
    ipAddress: ipAddress || undefined,
    userAgent: userAgent || undefined,
  };

  await submitToHubspotForm({ portalId, formGuid, fields, context });
  return { sent: true };
}

module.exports = {
  buildMessage,
  trackLeadInHubspot,
};
