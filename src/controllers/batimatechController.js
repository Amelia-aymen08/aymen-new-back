const db = require('../models');
const { signToken } = require('../utils/batimatechAuth');

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

async function login(req, res) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email requis.' });
    }

    const salesAgent = await db.SalesAgent.findOne({ where: { email } });
    if (!salesAgent || !salesAgent.isActive) {
      return res.status(401).json({ success: false, message: 'Adresse email non autorisée.' });
    }

    const token = signToken({
      id: salesAgent.id,
      email: salesAgent.email,
      fullName: salesAgent.fullName,
    });

    return res.status(200).json({
      success: true,
      token,
      salesAgent: {
        id: salesAgent.id,
        fullName: salesAgent.fullName,
        email: salesAgent.email,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur lors de la connexion.', error: error.message });
  }
}

async function me(req, res) {
  const salesAgent = req.salesAgent;
  return res.status(200).json({
    success: true,
    salesAgent: {
      id: salesAgent.id,
      fullName: salesAgent.fullName,
      email: salesAgent.email,
    },
  });
}

async function listProjects(req, res) {
  try {
    const projects = await db.Project.findAll({
      attributes: ['id', 'title'],
      order: [['title', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      projects,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur lors de la récupération des projets.', error: error.message });
  }
}

async function createLead(req, res) {
  try {
    const {
      prospectLastName,
      prospectFirstName,
      phone,
      email,
      projectName,
      appointmentDate,
      appointmentSlot,
    } = req.body;

    if (!prospectLastName || !prospectFirstName || !phone || !appointmentDate || !appointmentSlot) {
      return res.status(400).json({
        success: false,
        message: 'Les champs obligatoires du prospect et du rendez-vous doivent être remplis.',
      });
    }

    const existing = await db.BatimatechLead.findOne({
      where: { salesAgentId: req.salesAgent.id, appointmentDate, appointmentSlot },
      attributes: ['id'],
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Vous avez déjà réservé ce créneau. Veuillez en choisir un autre.',
      });
    }

    const lead = await db.BatimatechLead.create({
      salesAgentId: req.salesAgent.id,
      salesAgentName: req.salesAgent.fullName,
      prospectLastName,
      prospectFirstName,
      phone,
      email: email || null,
      projectName: projectName || null,
      appointmentDate,
      appointmentSlot,
    });

    return res.status(201).json({
      success: true,
      message: 'Le rendez-vous prospect a bien été enregistré.',
      data: lead,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur lors de l'enregistrement du prospect.",
      error: error.message,
    });
  }
}

async function listBookedSlots(req, res) {
  try {
    const date = String(req.query?.date || '').trim();
    if (!date) {
      return res.status(400).json({ success: false, message: 'Paramètre date requis.' });
    }

    const leads = await db.BatimatechLead.findAll({
      where: { salesAgentId: req.salesAgent.id, appointmentDate: date },
      attributes: ['appointmentSlot'],
    });

    const bookedSlots = leads.map((l) => l.appointmentSlot).filter(Boolean);
    return res.status(200).json({ success: true, date, bookedSlots });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des créneaux.',
      error: error.message,
    });
  }
}

module.exports = {
  login,
  me,
  listProjects,
  createLead,
  listBookedSlots,
  listLeads,
};

async function listLeads(req, res) {
  try {
    const Op = db.Sequelize.Op;
    const from = String(req.query?.from || '').trim();
    const to = String(req.query?.to || '').trim();
    const status = String(req.query?.status || '').trim();
    const salesAgentIdRaw = String(req.query?.salesAgentId || '').trim();
    const projectName = String(req.query?.projectName || '').trim();
    const q = String(req.query?.q || '').trim();

    const limit = Math.min(parsePositiveInt(req.query?.limit, 200), 1000);
    const offset = parsePositiveInt(req.query?.offset, 0);

    const where = {};

    if (from && to) {
      where.appointmentDate = { [Op.between]: [from, to] };
    } else if (from) {
      where.appointmentDate = { [Op.gte]: from };
    } else if (to) {
      where.appointmentDate = { [Op.lte]: to };
    }

    if (status) where.status = status;
    if (projectName) where.projectName = projectName;

    if (salesAgentIdRaw) {
      const salesAgentId = Number.parseInt(salesAgentIdRaw, 10);
      if (Number.isFinite(salesAgentId)) where.salesAgentId = salesAgentId;
    }

    if (q) {
      where[Op.or] = [
        { salesAgentName: { [Op.like]: `%${q}%` } },
        { prospectFirstName: { [Op.like]: `%${q}%` } },
        { prospectLastName: { [Op.like]: `%${q}%` } },
        { phone: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
        { projectName: { [Op.like]: `%${q}%` } },
        { appointmentSlot: { [Op.like]: `%${q}%` } },
      ];
    }

    const result = await db.BatimatechLead.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: db.SalesAgent
        ? [
            {
              model: db.SalesAgent,
              as: 'salesAgent',
              attributes: ['id', 'fullName', 'email', 'isActive'],
            },
          ]
        : undefined,
    });

    return res.status(200).json({
      success: true,
      total: result.count,
      limit,
      offset,
      leads: result.rows,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur lors de la récupération des leads.', error: error.message });
  }
}
