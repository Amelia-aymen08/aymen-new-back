// Canal OTP réel : email via le SMTP Brevo déjà configuré dans .env.
// Aucun fournisseur SMS n'est disponible dans ce dépôt (docs/decisions.md, D3).
// Remplacer ce module par un vrai fournisseur SMS ne change pas le contrat
// d'authService.js : seule la fonction sendOtpEmail est appelée.
const nodemailer = require('nodemailer');

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return cachedTransporter;
}

async function sendOtpEmail({ to, code }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[Mobile OTP] SMTP non configuré (SMTP_PASS manquant) — email non envoyé, code disponible uniquement via devEcho hors production.');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'contact@aymenpromotion.com',
      envelope: process.env.SMTP_ENVELOPE_FROM ? { from: process.env.SMTP_ENVELOPE_FROM, to } : undefined,
      to,
      subject: 'Votre code de connexion Aymen Promotion',
      text: `Votre code de connexion est ${code}. Il expire dans 5 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
      html: `<p>Votre code de connexion Aymen Promotion est :</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p><p>Il expire dans 5 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
    });
    return { sent: true };
  } catch (err) {
    console.error('[Mobile OTP] Échec envoi email:', err.message);
    return { sent: false, reason: 'smtp_error' };
  }
}

module.exports = { sendOtpEmail };
