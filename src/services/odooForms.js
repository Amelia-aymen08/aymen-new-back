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
  const url = getEnv('ODOO_URL');
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
  const url = getEnv('ODOO_URL');
  const apiKey = getEnv('ODOO_APIKEY');

  const res = await requestJson(`${url}/api/crm/lead`, {
    body: data,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Cookie: sessionCookies.map((c) => c.split(';')[0]).join('; '),
    },
  });

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`Odoo lead submit failed (${res.statusCode}): ${res.raw}`);
  }

  return res.body;
}

/**
 * Envoie un lead (devis/contact) vers Odoo CRM. Ne rejette jamais : retourne
 * un statut { sent, reason? } pour que l'appelant journalise sans planter.
 */
async function pushLeadToOdoo(fields) {
  const url = getEnv('ODOO_URL');
  if (!url) return { sent: false, reason: 'missing_config' };

  try {
    const sessionCookies = await authenticateOdoo();
    if (!sessionCookies) {
      return { sent: false, reason: 'auth_failed' };
    }

    const result = await sendLeadToOdoo(fields, sessionCookies);
    return { sent: true, result };
  } catch (e) {
    console.warn("[Odoo] Erreur lors de l'envoi du lead:", e?.message || e);
    return { sent: false, reason: 'error', error: e?.message };
  }
}

module.exports = { pushLeadToOdoo };
