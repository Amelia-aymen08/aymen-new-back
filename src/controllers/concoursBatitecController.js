const db = require('../models');
const { Op } = require('sequelize');

function toInt(value, fallback) {
  const n = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function escapeCsv(value) {
  const s = value === null || value === undefined ? '' : String(value);
  const needsQuotes = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

async function createApplication(req, res) {
  try {
    return res.status(410).json({
      success: false,
      message: 'Les candidatures ont été clôturées.',
    });

    const category = String(req.body?.category || '').trim().toUpperCase();
    const lastName = String(req.body?.lastName || '').trim();
    const firstName = String(req.body?.firstName || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();

    const file = req.file;
    const allowedCategories = ['HOTEL', 'VILLA'];
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ success: false, message: 'Catégorie invalide.' });
    }

    if (!lastName || !firstName || !phone || !email) {
      return res.status(400).json({ success: false, message: 'Tous les champs obligatoires doivent être remplis.' });
    }

    if (!file) {
      return res.status(400).json({ success: false, message: "La carte d'étudiant est obligatoire." });
    }

    if (!allowedMimes.includes(file.mimetype)) {
      return res.status(400).json({ success: false, message: 'Format de fichier non accepté.' });
    }

    const created = await db.ConcoursBatitecApplication.create({
      category,
      lastName,
      firstName,
      phone,
      email,
      studentCardPath: `uploads/concours-batitec/${file.filename}`,
      studentCardMime: file.mimetype,
    });

    return res.status(201).json({
      success: true,
      message: 'Votre candidature a été envoyée avec succès.',
      data: { id: created.id },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de l'envoi de votre candidature.",
      error: error.message,
    });
  }
}

async function listApplications(req, res) {
  try {
    const category = String(req.query?.category || '').trim().toUpperCase();
    const where = {};
    if (category === 'HOTEL' || category === 'VILLA') where.category = category;

    const from = String(req.query?.from || '').trim();
    const to = String(req.query?.to || '').trim();
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }

    const limit = Math.min(toInt(req.query?.limit, 1000), 10000);
    const offset = Math.max(toInt(req.query?.offset, 0), 0);
    const format = String(req.query?.format || 'json').trim().toLowerCase();

    const data = await db.ConcoursBatitecApplication.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    if (format === 'csv') {
      const headers = [
        'id',
        'category',
        'lastName',
        'firstName',
        'phone',
        'email',
        'studentCardPath',
        'studentCardMime',
        'createdAt',
        'updatedAt',
      ];

      const rows = data.map((r) => [
        r.id,
        r.category,
        r.lastName,
        r.firstName,
        r.phone,
        r.email,
        r.studentCardPath,
        r.studentCardMime,
        r.createdAt,
        r.updatedAt,
      ]);

      const csv = [headers.join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="concours_batitec_applications.csv"');
      return res.status(200).send(csv);
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la récupération des candidatures.',
      error: error.message,
    });
  }
}

module.exports = {
  createApplication,
  listApplications,
};
