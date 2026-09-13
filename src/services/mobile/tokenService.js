const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ACCESS_TTL_MIN = Number(process.env.MOBILE_ACCESS_TOKEN_TTL_MIN) || 15;
const REFRESH_TTL_DAYS = Number(process.env.MOBILE_REFRESH_TOKEN_TTL_DAYS) || 30;

function jwtSecret() {
  const secret = process.env.MOBILE_JWT_SECRET;
  if (!secret) throw new Error('MOBILE_JWT_SECRET manquant côté serveur.');
  return secret;
}

function otpSecret() {
  const secret = process.env.MOBILE_OTP_HMAC_SECRET;
  if (!secret) throw new Error('MOBILE_OTP_HMAC_SECRET manquant côté serveur.');
  return secret;
}

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, locale: user.locale },
    jwtSecret(),
    { expiresIn: `${ACCESS_TTL_MIN}m` }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, jwtSecret());
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function hashToken(token) {
  return crypto.createHmac('sha256', jwtSecret()).update(token).digest('hex');
}

function refreshExpiryDate() {
  return new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashOtpCode(code, destination) {
  return crypto.createHmac('sha256', otpSecret()).update(`${destination}:${code}`).digest('hex');
}

module.exports = {
  ACCESS_TTL_MIN,
  REFRESH_TTL_DAYS,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  refreshExpiryDate,
  generateOtpCode,
  hashOtpCode,
};
