const db = require('../../models');
const { MobileUser, MobileInterestProfile, MobileFavorite, MobileConsent, MobileNotification, MobileAuthSession, MobileDevice, Project } = db;
const { mapProjectSummary } = require('./catalogController');

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message, retryable: false } });
}

exports.getMe = async (req, res) => {
  const user = req.mobileUser;
  res.json({
    data: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      locale: user.locale,
      timezone: user.timezone,
      status: user.status,
      version: user.version,
    },
  });
};

exports.patchMe = async (req, res) => {
  const user = req.mobileUser;
  const { fullName, locale, timezone } = req.body || {};
  const updates = {};
  if (fullName !== undefined) updates.fullName = fullName;
  if (locale !== undefined) updates.locale = locale;
  if (timezone !== undefined) updates.timezone = timezone;
  updates.version = user.version + 1;

  await user.update(updates);
  res.json({ data: { id: user.id, email: user.email, fullName: user.fullName, locale: user.locale, timezone: user.timezone } });
};

exports.putInterests = async (req, res) => {
  const user = req.mobileUser;
  const { objective, localityIds, typologies, budgetBand, timeframe, financing, diaspora } = req.body || {};

  const [profile] = await MobileInterestProfile.findOrCreate({
    where: { userId: user.id },
    defaults: { userId: user.id },
  });

  await profile.update({
    objective: objective ?? profile.objective,
    localityIds: localityIds ?? profile.localityIds,
    typologies: typologies ?? profile.typologies,
    budgetBand: budgetBand ?? profile.budgetBand,
    timeframe: timeframe ?? profile.timeframe,
    financing: financing ?? profile.financing,
    diaspora: diaspora ?? profile.diaspora,
  });

  res.json({ data: profile });
};

exports.getInterests = async (req, res) => {
  const profile = await MobileInterestProfile.findByPk(req.mobileUser.id);
  res.json({ data: profile || null });
};

exports.listFavorites = async (req, res) => {
  const favorites = await MobileFavorite.findAll({
    where: { userId: req.mobileUser.id, deletedAt: null },
    include: [{ model: Project, as: 'project', include: ['locality'] }],
  });
  res.json({
    data: favorites
      .filter((f) => f.project)
      .map((f) => ({ ...mapProjectSummary(f.project), favoritedAt: f.updatedAt, version: f.version })),
  });
};

exports.putFavorite = async (req, res) => {
  const projectId = Number(req.params.projectId);
  const project = await Project.findByPk(projectId);
  if (!project) return sendError(res, 404, 'PROJECT_NOT_FOUND', 'Projet introuvable.');

  const [favorite, created] = await MobileFavorite.findOrCreate({
    where: { userId: req.mobileUser.id, projectId },
    defaults: { userId: req.mobileUser.id, projectId },
  });
  if (!created) {
    await favorite.update({ deletedAt: null, version: favorite.version + 1 });
  }
  res.json({ data: { projectId: String(projectId), favorited: true, version: favorite.version } });
};

exports.deleteFavorite = async (req, res) => {
  const projectId = Number(req.params.projectId);
  const favorite = await MobileFavorite.findOne({ where: { userId: req.mobileUser.id, projectId } });
  if (favorite) {
    await favorite.update({ deletedAt: new Date(), version: favorite.version + 1 });
  }
  res.json({ data: { projectId: String(projectId), favorited: false } });
};

exports.mergeFavorites = async (req, res) => {
  const { projectIds } = req.body || {};
  if (!Array.isArray(projectIds)) {
    return sendError(res, 400, 'INVALID_REQUEST', 'projectIds doit être un tableau.');
  }

  const results = [];
  for (const rawId of projectIds) {
    const projectId = Number(rawId);
    if (!Number.isFinite(projectId)) continue;
    const [favorite] = await MobileFavorite.findOrCreate({
      where: { userId: req.mobileUser.id, projectId },
      defaults: { userId: req.mobileUser.id, projectId },
    });
    if (favorite.deletedAt) {
      // Tombstone respecté : une suppression après connexion n'est pas ressuscitée par la fusion.
      continue;
    }
    results.push(projectId);
  }

  res.json({ data: { merged: results.map(String) } });
};

exports.getConsents = async (req, res) => {
  const consents = await MobileConsent.findAll({ where: { userId: req.mobileUser.id } });
  res.json({ data: consents.map((c) => ({ purpose: c.purpose, state: c.state, policyVersion: c.policyVersion, capturedAt: c.capturedAt })) });
};

exports.putConsents = async (req, res) => {
  const { purpose, state } = req.body || {};
  if (!['service', 'analytics', 'marketing'].includes(purpose) || !['granted', 'denied'].includes(state)) {
    return sendError(res, 422, 'INVALID_CONSENT', 'purpose/state invalides.');
  }

  const [consent] = await MobileConsent.findOrCreate({
    where: { userId: req.mobileUser.id, purpose },
    defaults: { userId: req.mobileUser.id, purpose, state },
  });
  await consent.update({ state, capturedAt: new Date() });

  res.json({ data: { purpose: consent.purpose, state: consent.state, capturedAt: consent.capturedAt } });
};

exports.requestDeletion = async (req, res) => {
  const user = req.mobileUser;
  await MobileAuthSession.update({ revokedAt: new Date() }, { where: { userId: user.id, revokedAt: null } });
  await user.update({ status: 'deleted', fullName: null, email: `deleted-${user.id}@aymenpromotion.invalid` });

  res.json({ data: { status: 'deleted', receipt: `DEL-${user.id.slice(0, 8).toUpperCase()}` } });
};

exports.listNotifications = async (req, res) => {
  const notifications = await MobileNotification.findAll({
    where: { userId: req.mobileUser.id },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  res.json({ data: notifications });
};

exports.markNotificationRead = async (req, res) => {
  const notification = await MobileNotification.findOne({ where: { id: req.params.id, userId: req.mobileUser.id } });
  if (!notification) return sendError(res, 404, 'NOTIFICATION_NOT_FOUND', 'Notification introuvable.');
  await notification.update({ readAt: new Date() });
  res.json({ data: notification });
};

exports.upsertDevice = async (req, res) => {
  const { installationId, platform, pushToken } = req.body || {};
  if (!installationId) return sendError(res, 400, 'INVALID_REQUEST', 'installationId requis.');

  const [device] = await MobileDevice.findOrCreate({
    where: { installationId },
    defaults: { installationId, userId: req.mobileUser.id, platform, pushToken },
  });
  await device.update({ userId: req.mobileUser.id, platform, pushToken, lastSeenAt: new Date() });
  res.json({ data: { id: device.id } });
};
