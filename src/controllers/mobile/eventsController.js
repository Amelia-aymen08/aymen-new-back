// Point de collecte analytics unique : journalise en base (tampon interne).
// Aucun envoi GA4/BigQuery/Meta n'est effectué depuis cet environnement
// (docs/decisions.md D11). Le contrat de réponse (accepted/ignored/rejected)
// est conforme au cahier §13.2 pour permettre un futur exporteur sans
// changer le client.
const db = require('../../models');
const { MobileEvent } = db;

const MAX_BATCH_SIZE = 50;

exports.batch = async (req, res) => {
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  if (!events.length) {
    return res.status(400).json({ error: { code: 'EMPTY_BATCH', message: 'Aucun événement fourni.', retryable: false } });
  }
  if (events.length > MAX_BATCH_SIZE) {
    return res.status(400).json({ error: { code: 'BATCH_TOO_LARGE', message: `Limite de ${MAX_BATCH_SIZE} événements par lot.`, retryable: false } });
  }

  const accepted = [];
  const rejected = [];

  for (const evt of events) {
    if (!evt?.eventName || !evt?.eventId) {
      rejected.push({ eventId: evt?.eventId || null, reason: 'missing_fields' });
      continue;
    }
    try {
      await MobileEvent.findOrCreate({
        where: { id: evt.eventId },
        defaults: {
          id: evt.eventId,
          userId: req.mobileUser?.id || null,
          installationId: evt.installationId || null,
          eventName: evt.eventName,
          eventVersion: evt.eventVersion || 1,
          occurredAt: evt.occurredAt ? new Date(evt.occurredAt) : new Date(),
          payload: evt.payload || null,
        },
      });
      accepted.push(evt.eventId);
    } catch (err) {
      rejected.push({ eventId: evt.eventId, reason: 'storage_error' });
    }
  }

  res.status(202).json({ data: { accepted, ignored: [], rejected } });
};
