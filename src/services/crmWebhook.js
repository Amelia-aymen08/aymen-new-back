const crypto = require('crypto');

// Webhook sortant : à chaque soumission de formulaire, on POST un JSON signé vers
// l'URL du CRM interne (CRM_WEBHOOK_URL). L'envoi est en arrière-plan : il ne
// bloque ni ne fait jamais échouer la réponse faite au visiteur.

const RETRY_DELAYS_MS = [0, 2000, 10000];

function getEnv(name) {
  const v = process.env[name];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function toPlain(data) {
  if (data && typeof data.toJSON === 'function') return data.toJSON();
  return data ?? null;
}

function sign(secret, timestamp, body) {
  return `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

async function deliver({ url, secret, timeoutMs, id, form, body }) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'aymen-immobilier-webhook/1.0',
    'X-Webhook-Id': id,
    'X-Webhook-Event': `form.${form}`,
    'X-Webhook-Timestamp': timestamp,
  };
  if (secret) headers['X-Webhook-Signature'] = sign(secret, timestamp, body);

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (res.ok) return;
  const err = new Error(`CRM webhook responded ${res.status}`);
  // 4xx (hors 408/429) = payload/URL refusé : inutile de réessayer.
  err.retryable = res.status >= 500 || res.status === 408 || res.status === 429;
  throw err;
}

async function deliverWithRetry(job) {
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    if (RETRY_DELAYS_MS[attempt]) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
    try {
      await deliver(job);
      return;
    } catch (e) {
      const last = attempt === RETRY_DELAYS_MS.length - 1;
      if (e.retryable === false || last) {
        console.warn(`[CRM webhook] form.${job.form} (${job.id}) abandonné après ${attempt + 1} tentative(s):`, e?.message || e);
        return;
      }
    }
  }
}

/**
 * Notifie le CRM qu'un formulaire vient d'être soumis.
 * @param {string} form     identifiant du formulaire (ex. 'contact', 'quote')
 * @param {object} record   enregistrement créé en BDD (instance Sequelize ou objet)
 * @param {object} [context] métadonnées de soumission (pageUri, pageName, ipAddress, userAgent…)
 */
function notifyCrm(form, record, context = {}) {
  try {
    const url = getEnv('CRM_WEBHOOK_URL');
    if (!url) return;

    const id = crypto.randomUUID();
    const body = JSON.stringify({
      id,
      event: `form.${form}`,
      form,
      occurredAt: new Date().toISOString(),
      source: 'aymen-immobilier-website',
      data: toPlain(record),
      context,
    });

    const timeoutMs = Number.parseInt(getEnv('CRM_WEBHOOK_TIMEOUT_MS') || '', 10) || 6500;

    deliverWithRetry({ url, secret: getEnv('CRM_WEBHOOK_SECRET'), timeoutMs, id, form, body }).catch((e) => {
      console.warn(`[CRM webhook] form.${form} erreur inattendue:`, e?.message || e);
    });
  } catch (e) {
    console.warn(`[CRM webhook] form.${form} non envoyé:`, e?.message || e);
  }
}

// Métadonnées de soumission, construites comme pour HubSpot (pageUri du client, sinon referer).
function requestContext(req, { pageUri, pageName } = {}) {
  return {
    pageUri: pageUri || req.get('referer') || null,
    pageName: pageName || null,
    ipAddress: req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket?.remoteAddress || null,
    userAgent: req.get('user-agent') || null,
  };
}

module.exports = { notifyCrm, requestContext };
