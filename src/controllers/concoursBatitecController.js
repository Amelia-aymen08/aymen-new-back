const db = require('../models');

async function createApplication(req, res) {
  try {
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

    const data = await db.ConcoursBatitecApplication.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

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

