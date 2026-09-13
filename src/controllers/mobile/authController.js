const { Op } = require('sequelize');
const db = require('../../models');
const { MobileUser, MobileOtpChallenge, MobileAuthSession, MobileFavorite } = db;
const { sendOtpEmail } = require('../../services/mobile/otpMailer');
const {
  generateOtpCode,
  hashOtpCode,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  refreshExpiryDate,
} = require('../../services/mobile/tokenService');

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isDev() {
  return process.env.NODE_ENV !== 'production';
}

function sendError(res, status, code, message, fields) {
  return res.status(status).json({ error: { code, message, fields, retryable: status >= 500 } });
}

exports.requestOtp = async (req, res) => {
  const destination = normalizeEmail(req.body?.destination);
  const purpose = req.body?.purpose === 'login' ? 'login' : 'login';

  if (!destination || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
    return sendError(res, 422, 'INVALID_DESTINATION', 'Adresse email invalide.', { destination: 'invalid' });
  }

  const existing = await MobileOtpChallenge.findOne({
    where: { destination, purpose, consumedAt: null },
    order: [['createdAt', 'DESC']],
  });

  if (existing && existing.resendAvailableAt > new Date()) {
    const retryAfterSec = Math.ceil((existing.resendAvailableAt.getTime() - Date.now()) / 1000);
    return res.status(429).json({
      error: { code: 'OTP_RESEND_TOO_SOON', message: 'Veuillez patienter avant de redemander un code.', retryable: true },
      retryAfter: retryAfterSec,
    });
  }

  const code = generateOtpCode();
  const challenge = await MobileOtpChallenge.create({
    destination,
    purpose,
    codeHash: hashOtpCode(code, destination),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    resendAvailableAt: new Date(Date.now() + OTP_RESEND_COOLDOWN_MS),
  });

  const mail = await sendOtpEmail({ to: destination, code });

  const response = {
    data: {
      challengeId: challenge.id,
      destinationMasked: destination.replace(/^(.{2}).*(@.*)$/, '$1***$2'),
      expiresInSeconds: OTP_TTL_MS / 1000,
      resendAvailableInSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
      emailSent: mail.sent,
    },
    request_id: req.headers['x-request-id'] || null,
  };

  if (isDev()) {
    response.devEcho = { code, warning: 'Visible uniquement hors production (NODE_ENV != production).' };
    console.warn(`[DEV-ONLY OTP] destination=${destination} code=${code}`);
  }

  res.status(201).json(response);
};

exports.verifyOtp = async (req, res) => {
  const { challengeId, code } = req.body || {};
  if (!challengeId || !code) {
    return sendError(res, 400, 'INVALID_REQUEST', 'challengeId et code sont requis.');
  }

  const challenge = await MobileOtpChallenge.findByPk(challengeId);
  if (!challenge || challenge.consumedAt) {
    return sendError(res, 401, 'OTP_INVALID', 'Code invalide ou déjà utilisé.');
  }
  if (challenge.expiresAt < new Date()) {
    return sendError(res, 401, 'OTP_EXPIRED', 'Ce code a expiré, demandez-en un nouveau.');
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    return sendError(res, 429, 'OTP_TOO_MANY_ATTEMPTS', 'Trop de tentatives, demandez un nouveau code.');
  }

  const expectedHash = hashOtpCode(String(code).trim(), challenge.destination);
  if (expectedHash !== challenge.codeHash) {
    await challenge.increment('attempts');
    return sendError(res, 401, 'OTP_INVALID', 'Code invalide.', { code: 'invalid' });
  }

  await challenge.update({ consumedAt: new Date() });

  let user = await MobileUser.findOne({ where: { email: challenge.destination } });
  const isNewUser = !user;
  if (!user) {
    user = await MobileUser.create({ email: challenge.destination });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  const familyId = require('crypto').randomUUID();

  await MobileAuthSession.create({
    userId: user.id,
    familyId,
    refreshTokenHash: hashToken(refreshToken),
    deviceId: req.body?.deviceId || null,
    platform: req.body?.platform || null,
    expiresAt: refreshExpiryDate(),
    lastUsedAt: new Date(),
  });

  res.json({
    data: {
      accessToken,
      refreshToken,
      isNewUser,
      user: { id: user.id, email: user.email, locale: user.locale, timezone: user.timezone },
    },
    request_id: req.headers['x-request-id'] || null,
  });
};

exports.refresh = async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return sendError(res, 400, 'INVALID_REQUEST', 'refreshToken requis.');
  }

  const tokenHash = hashToken(refreshToken);
  const session = await MobileAuthSession.findOne({ where: { refreshTokenHash: tokenHash } });

  if (!session || session.revokedAt) {
    if (session?.revokedAt) {
      await MobileAuthSession.update({ revokedAt: new Date() }, { where: { familyId: session.familyId } });
    }
    return sendError(res, 401, 'SESSION_EXPIRED', 'Session expirée, reconnectez-vous.');
  }
  if (session.expiresAt < new Date()) {
    return sendError(res, 401, 'SESSION_EXPIRED', 'Session expirée, reconnectez-vous.');
  }

  const user = await MobileUser.findByPk(session.userId);
  if (!user || user.status === 'deleted') {
    return sendError(res, 401, 'SESSION_EXPIRED', 'Session expirée, reconnectez-vous.');
  }

  const newRefreshToken = generateRefreshToken();
  await session.update({
    refreshTokenHash: hashToken(newRefreshToken),
    expiresAt: refreshExpiryDate(),
    lastUsedAt: new Date(),
  });

  res.json({
    data: { accessToken: generateAccessToken(user), refreshToken: newRefreshToken },
    request_id: req.headers['x-request-id'] || null,
  });
};

exports.logout = async (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    await MobileAuthSession.update(
      { revokedAt: new Date() },
      { where: { refreshTokenHash: hashToken(refreshToken) } }
    );
  }
  res.status(204).send();
};
