// Aucun calendrier commercial réel n'étant accessible depuis ce dépôt
// (docs/decisions.md D6), les créneaux sont générés à la volée (jours ouvrés
// Algérie dimanche-jeudi, 9h-17h, pas d'une heure) et la capacité (3 par
// créneau/mode) est vérifiée par comptage transactionnel au moment de la
// réservation. À remplacer par le vrai calendrier commercial dès qu'il sera
// identifié, sans changer le contrat de l'API mobile.
const db = require('../../models');
const { MobileAppointment, Project } = db;

const CAPACITY_PER_SLOT = 3;
const BUSINESS_DAYS = [0, 1, 2, 3, 4]; // dimanche(0) à jeudi(4)
const BUSINESS_HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
const DEFAULT_TIMEZONE = 'Africa/Algiers';

function sendError(res, status, code, message, fields) {
  return res.status(status).json({ error: { code, message, fields, retryable: status >= 500 } });
}

function generateSlots(days = 14) {
  const slots = [];
  const now = new Date();
  for (let d = 0; d < days; d += 1) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + d);
    if (!BUSINESS_DAYS.includes(day.getUTCDay())) continue;

    for (const hour of BUSINESS_HOURS) {
      const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, 0, 0));
      if (start <= now) continue;
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      slots.push({ startAt: start, endAt: end });
    }
  }
  return slots;
}

exports.listSlots = async (req, res) => {
  const days = Math.min(Number(req.query.days) || 14, 30);
  const mode = ['showroom', 'video', 'phone'].includes(req.query.mode) ? req.query.mode : 'showroom';
  const slots = generateSlots(days);

  const startAts = slots.map((s) => s.startAt);
  const bookedCounts = await MobileAppointment.findAll({
    where: { mode, status: 'confirmed', startAt: startAts },
    attributes: ['startAt', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
    group: ['startAt'],
  });
  const countByTime = new Map(bookedCounts.map((row) => [row.get('startAt').toISOString(), Number(row.get('count'))]));

  res.json({
    data: slots.map((s) => ({
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      mode,
      capacity: CAPACITY_PER_SLOT,
      bookedCount: countByTime.get(s.startAt.toISOString()) || 0,
      available: (countByTime.get(s.startAt.toISOString()) || 0) < CAPACITY_PER_SLOT,
    })),
    meta: { timezone: DEFAULT_TIMEZONE, capacityPerSlot: CAPACITY_PER_SLOT },
  });
};

exports.createAppointment = async (req, res) => {
  const { projectId, mode, startAt, timezone, idempotencyKey, notes } = req.body || {};

  if (!startAt || !['showroom', 'video', 'phone'].includes(mode)) {
    return sendError(res, 422, 'INVALID_APPOINTMENT', 'mode et startAt sont requis.', { mode: 'invalid', startAt: 'invalid' });
  }

  const start = new Date(startAt);
  if (Number.isNaN(start.getTime()) || start <= new Date()) {
    return sendError(res, 422, 'INVALID_APPOINTMENT', 'startAt doit être une date future valide.', { startAt: 'invalid' });
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  if (idempotencyKey) {
    const existing = await MobileAppointment.findOne({ where: { idempotencyKey, userId: req.mobileUser.id } });
    if (existing) {
      return res.status(200).json({ data: existing });
    }
  }

  try {
    const result = await db.sequelize.transaction(async (t) => {
      const bookedCount = await MobileAppointment.count({
        where: { mode, startAt: start, status: 'confirmed' },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (bookedCount >= CAPACITY_PER_SLOT) {
        const err = new Error('SLOT_UNAVAILABLE');
        err.code = 'SLOT_UNAVAILABLE';
        throw err;
      }

      return MobileAppointment.create(
        {
          userId: req.mobileUser.id,
          projectId: projectId ? Number(projectId) : null,
          mode,
          startAt: start,
          endAt: end,
          timezone: timezone || DEFAULT_TIMEZONE,
          idempotencyKey: idempotencyKey || null,
          notes: notes || null,
        },
        { transaction: t }
      );
    });

    res.status(201).json({ data: result });
  } catch (err) {
    if (err.code === 'SLOT_UNAVAILABLE') {
      return res.status(409).json({
        error: { code: 'APPOINTMENT_SLOT_UNAVAILABLE', message: 'Ce créneau vient d’être réservé.', fields: { startAt: 'unavailable' }, retryable: false },
      });
    }
    console.error('[mobile/appointments/create]', err);
    res.status(500).json({ error: { code: 'APPOINTMENT_FAILED', message: 'La réservation a échoué.', retryable: true } });
  }
};

exports.listMyAppointments = async (req, res) => {
  const appointments = await MobileAppointment.findAll({
    where: { userId: req.mobileUser.id },
    include: [{ model: Project, as: 'project', attributes: ['id', 'title', 'slug'] }],
    order: [['startAt', 'DESC']],
  });
  res.json({ data: appointments });
};

exports.getAppointment = async (req, res) => {
  const appointment = await MobileAppointment.findOne({
    where: { id: req.params.id, userId: req.mobileUser.id },
    include: [{ model: Project, as: 'project', attributes: ['id', 'title', 'slug'] }],
  });
  if (!appointment) return sendError(res, 404, 'APPOINTMENT_NOT_FOUND', 'Rendez-vous introuvable.');
  res.json({ data: appointment });
};

exports.updateAppointment = async (req, res) => {
  const appointment = await MobileAppointment.findOne({ where: { id: req.params.id, userId: req.mobileUser.id } });
  if (!appointment) return sendError(res, 404, 'APPOINTMENT_NOT_FOUND', 'Rendez-vous introuvable.');

  const { startAt, expectedVersion } = req.body || {};
  if (expectedVersion !== undefined && Number(expectedVersion) !== appointment.version) {
    return res.status(409).json({ error: { code: 'APPOINTMENT_VERSION_CONFLICT', message: 'Ce rendez-vous a été modifié entre-temps.', retryable: false } });
  }

  if (startAt) {
    const start = new Date(startAt);
    if (Number.isNaN(start.getTime()) || start <= new Date()) {
      return sendError(res, 422, 'INVALID_APPOINTMENT', 'startAt invalide.', { startAt: 'invalid' });
    }
    await appointment.update({
      startAt: start,
      endAt: new Date(start.getTime() + 60 * 60 * 1000),
      status: 'rescheduled',
      version: appointment.version + 1,
    });
    await appointment.update({ status: 'confirmed' });
  }

  res.json({ data: appointment });
};

exports.cancelAppointment = async (req, res) => {
  const appointment = await MobileAppointment.findOne({ where: { id: req.params.id, userId: req.mobileUser.id } });
  if (!appointment) return sendError(res, 404, 'APPOINTMENT_NOT_FOUND', 'Rendez-vous introuvable.');

  await appointment.update({ status: 'cancelled', version: appointment.version + 1 });
  res.json({ data: appointment });
};

exports.getAppointmentCalendar = async (req, res) => {
  const appointment = await MobileAppointment.findOne({
    where: { id: req.params.id, userId: req.mobileUser.id },
    include: [{ model: Project, as: 'project', attributes: ['title'] }],
  });
  if (!appointment) return sendError(res, 404, 'APPOINTMENT_NOT_FOUND', 'Rendez-vous introuvable.');

  const toIcsDate = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aymen Promotion//Mobile//FR',
    'BEGIN:VEVENT',
    `UID:${appointment.id}@aymenpromotion.com`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(new Date(appointment.startAt))}`,
    `DTEND:${toIcsDate(new Date(appointment.endAt))}`,
    `SUMMARY:Rendez-vous Aymen Promotion${appointment.project ? ' — ' + appointment.project.title : ''}`,
    `DESCRIPTION:Mode: ${appointment.mode}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="rdv-${appointment.id}.ics"`);
  res.send(ics);
};
