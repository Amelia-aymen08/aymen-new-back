const https = require('https');
const http = require('http');
const { URL } = require('url');

// Connexion CRM Odoo : à chaque devis, on authentifie une session Odoo puis on
// pousse le lead sur /api/crm/lead. Non bloquant : une erreur ici n'empêche
// jamais l'enregistrement local ni la réponse au visiteur.

function getEnv(name) {
  const v = process.env[name];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

// ODOO_URL peut être saisie avec un « / » final : on le retire pour ne pas appeler « //api/crm/lead ».
function odooBaseUrl() {
  const url = getEnv('ODOO_URL');
  return url ? url.replace(/\/+$/, '') : null;
}

function requestJson(targetUrl, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const transport = url.protocol === 'http:' ? http : https;
    const payload = body !== undefined ? JSON.stringify(body) : undefined;

    const req = transport.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'http:' ? 80 : 443),
        path: `${url.pathname}${url.search}`,
        headers: {
          'Content-Type': 'application/json',
          // Le module Odoo (get_ua_type) plante si aucun User-Agent n'est fourni.
          'User-Agent': 'aymen-immobilier-website/1.0',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
        // Instance Odoo exposée en HTTPS sur IP brute avec certificat auto-signé.
        rejectUnauthorized: false,
        timeout: 8000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch (e) {
            // réponse non JSON, on garde raw pour le debug
          }
          resolve({ statusCode: res.statusCode, headers: res.headers, body: json, raw });
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error('Odoo request timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function authenticateOdoo() {
  const url = odooBaseUrl();
  const db = getEnv('ODOO_DB');
  const login = getEnv('ODOO_USERNAME');
  const password = getEnv('ODOO_PASSWORD');
  if (!url || !db || !login || !password) return null;

  const res = await requestJson(`${url}/web/session/authenticate`, {
    body: { jsonrpc: '2.0', method: 'call', params: { db, login, password }, id: 1 },
  });

  if (res.statusCode === 200 && res.body && res.body.result) {
    const setCookie = res.headers['set-cookie'];
    return Array.isArray(setCookie) && setCookie.length ? setCookie : null;
  }

  console.warn('[Odoo] Échec authentification:', res.statusCode, res.body || res.raw);
  return null;
}

async function sendLeadToOdoo(data, sessionCookies) {
  const url = odooBaseUrl();
  const apiKey = getEnv('ODOO_APIKEY');

  const res = await requestJson(`${url}/api/crm/lead`, {
    body: data,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      // La clé API (Bearer) suffit pour /api/crm/lead : la session n'est jointe que si elle a pu être ouverte.
      ...(sessionCookies?.length ? { Cookie: sessionCookies.map((c) => c.split(';')[0]).join('; ') } : {}),
    },
  });

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`Odoo lead submit failed (${res.statusCode}): ${res.raw}`);
  }

  // Le endpoint JSON-RPC répond en HTTP 200 même en cas d'erreur applicative
  // (ex: validation refusée côté Odoo) : l'erreur est dans le corps, pas le statut.
  if (res.body?.error) {
    const msg = res.body.error.data?.message || res.body.error.message || 'Odoo RPC error';
    throw new Error(msg);
  }

  return res.body;
}

/**
 * Envoie un lead (devis/contact) vers Odoo CRM. Ne rejette jamais : retourne
 * un statut { sent, reason? } pour que l'appelant journalise sans planter.
 */
async function pushLeadToOdoo(fields) {
  const url = odooBaseUrl();
  if (!url) return { sent: false, reason: 'missing_config' };

  try {
    // Session facultative : un échec d'authentification (base ODOO_DB, mot de passe…) ne bloque plus
    // l'envoi, qui passe avec la clé API seule (comme un curl avec le Bearer).
    const sessionCookies = await authenticateOdoo().catch((e) => {
      console.warn('[Odoo] Authentification impossible, envoi avec la clé API seule:', e?.message || e);
      return null;
    });

    const result = await sendLeadToOdoo(fields, sessionCookies);
    return { sent: true, result };
  } catch (e) {
    console.warn("[Odoo] Erreur lors de l'envoi du lead:", e?.message || e);
    return { sent: false, reason: 'error', error: e?.message };
  }
}

module.exports = { pushLeadToOdoo };
