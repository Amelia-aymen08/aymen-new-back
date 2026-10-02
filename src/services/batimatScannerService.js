'use strict';

class ScannerError extends Error {
  constructor(status, code, message) {
    super(message); this.status = status; this.code = code;
  }
}
const fail = (status, code, message) => { throw new ScannerError(status, code, message); };
const iso = value => value ? new Date(value).toISOString() : null;

function parseBadge(value) {
  if (typeof value !== 'string' || value.length > 1024) fail(400, 'INVALID_QR', 'QR code invalide.');
  const parts = value.trim().split('|');
  if (parts.length !== 4 || parts[0] !== 'AYMEN-BA26' || !/^[a-f0-9]{32}$/i.test(parts[1])) {
    fail(400, 'INVALID_QR', 'Ce QR code ne correspond pas à un badge After Batimat.');
  }
  // Les noms du QR ne sont jamais utilisés comme preuve d'identité : seul le jeton compte.
  return parts[1].toLowerCase();
}
function publicRegistration(row) {
  return {
    id: row.id, firstName: row.firstName, lastName: row.lastName,
    email: row.email, phone: row.phone, visitDay: row.visitDay,
    checkedInAt: iso(row.checkedInAt), checkedOutAt: iso(row.checkedOutAt),
    badgeSentAt: iso(row.badgeSentAt),
    state: !row.checkedInAt ? 'registered' : row.checkedOutAt ? 'left' : 'inside',
  };
}
function validId(value) {
  if (!/^[1-9]\d{0,9}$/.test(String(value))) fail(400, 'INVALID_ID', 'Identifiant invalide.');
  return Number(value);
}
function validateRegistration(body) {
  for (const key of ['firstName', 'lastName', 'email', 'phone', 'countryCode', 'visitDay']) {
    if (typeof body?.[key] !== 'string' || !body[key].trim()) {
      fail(400, 'INVALID_FORM', 'Renseigne tous les champs obligatoires.');
    }
  }
  if (body.firstName.trim().length > 100 || body.lastName.trim().length > 100 ||
      body.email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
      body.phone.length > 50 || body.consent !== true) {
    fail(400, 'INVALID_FORM', 'Vérifie le nom, le téléphone, l’e-mail et le consentement.');
  }
  return {
    firstName: body.firstName.trim(), lastName: body.lastName.trim(),
    email: body.email.trim(), phone: body.phone.trim(), countryCode: body.countryCode,
    visitDay: body.visitDay, consent: true, newsletterOptIn: body.newsletterOptIn === true,
    qrCampaign: 'after-batimat-2026', qrSource: 'accueil-flutter',
    pageName: 'Inscription accueil After Batimat',
  };
}
function createScannerService({ model, sequelize, now = () => new Date() }) {
  return {
    async lookup(payload) {
      const row = await model.findOne({ where: { qrToken: parseBadge(payload) } });
      if (!row) fail(404, 'NOT_FOUND', 'Badge introuvable dans les inscriptions.');
      return publicRegistration(row);
    },
    async get(id) {
      const row = await model.findByPk(validId(id));
      if (!row) fail(404, 'NOT_FOUND', 'Inscription introuvable.');
      return publicRegistration(row);
    },
    async point(id, action, expected) {
      validId(id);
      if (!['in', 'out'].includes(action)) fail(400, 'INVALID_ACTION', 'Action invalide.');
      if (!expected || !Object.hasOwn(expected, 'checkedInAt') || !Object.hasOwn(expected, 'checkedOutAt')) {
        fail(400, 'SNAPSHOT_REQUIRED', 'Relis le badge avant de confirmer.');
      }
      // Verrou InnoDB commun à tous les téléphones et à tous les processus Node/PM2.
      return sequelize.transaction(async transaction => {
        const row = await model.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!row) fail(404, 'NOT_FOUND', 'Inscription introuvable.');
        if (iso(row.checkedInAt) !== expected.checkedInAt || iso(row.checkedOutAt) !== expected.checkedOutAt) {
          fail(409, 'STALE_STATE', 'Ce badge a été pointé depuis sa lecture. Relis-le pour voir son état actuel.');
        }
        if (action === 'in') {
          if (row.checkedInAt && !row.checkedOutAt) fail(409, 'ALREADY_INSIDE', 'Visiteur déjà présent.');
          await row.update({ checkedInAt: now(), checkedOutAt: null }, { transaction });
        } else {
          if (!row.checkedInAt) fail(409, 'NOT_CHECKED_IN', 'Aucune entrée enregistrée pour ce visiteur.');
          if (row.checkedOutAt) fail(409, 'ALREADY_LEFT', 'Sortie déjà enregistrée.');
          await row.update({ checkedOutAt: now() }, { transaction });
        }
        // MySQL DATETIME peut tronquer les millisecondes : renvoyer la valeur réellement stockée.
        await row.reload({ transaction });
        return publicRegistration(row);
      });
    },
  };
}
module.exports = { createScannerService, parseBadge, publicRegistration, validateRegistration, validId, ScannerError };
