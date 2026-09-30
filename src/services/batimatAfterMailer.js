const nodemailer = require('nodemailer');
const { generateBadgePdf, VISIT_DAYS } = require('./batimatAfterBadge');

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cachedTransporter;
}

const escapeHtml = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function buildEmail(reg) {
  const dayLabel =
    reg.visitDay === 'samedi' || reg.visitDay === 'dimanche'
      ? `${VISIT_DAYS[reg.visitDay].label} 2026`
      : 'Samedi 3 ou dimanche 4 octobre 2026';
  const name = escapeHtml(`${reg.firstName} ${reg.lastName}`);

  const subject = 'Votre badge Aymen Promotion — Paris, 3 & 4 octobre 2026';
  const text = [
    `Bonjour ${reg.firstName} ${reg.lastName},`,
    '',
    'Merci pour votre inscription. Votre badge visiteur est en pièce jointe : présentez-le (imprimé ou sur votre téléphone) à l’accueil.',
    '',
    `Jour souhaité : ${dayLabel}`,
    'Lieu : Hôtel Paris 17 Batignolles, 4 Boulevard Berthier, 75017 Paris',
    '',
    'Le QR code de votre badge est personnel et sera scanné à votre arrivée et à votre départ.',
    '',
    'Aymen Promotion — +213 560 58 29 59 — www.aymenpromotion-dz.com',
  ].join('\n');

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f2f4f3;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f3;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#015a4a;padding:28px 32px;">
<p style="margin:0;color:#F7C66A;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;">Aymen Promotion à Paris</p>
<h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;line-height:1.3;">Votre badge est prêt</h1>
</td></tr>
<tr><td style="padding:28px 32px;font-size:15px;line-height:1.6;">
<p style="margin:0 0 14px;">Bonjour ${name},</p>
<p style="margin:0 0 18px;">Merci pour votre inscription à notre rencontre parisienne. Votre <strong>badge visiteur</strong> est en pièce jointe : présentez-le, imprimé ou sur votre téléphone, à l’accueil.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f7f5;border-radius:8px;margin:0 0 18px;">
<tr><td style="padding:16px 20px;font-size:14px;line-height:1.7;">
<strong>Jour souhaité :</strong> ${escapeHtml(dayLabel)}<br>
<strong>Lieu :</strong> Hôtel Paris 17 Batignolles<br>
4 Boulevard Berthier, 75017 Paris
</td></tr></table>
<p style="margin:0 0 18px;font-size:13px;color:#555;">Le QR code de votre badge est personnel : il sera scanné à votre arrivée et à votre départ. Merci de ne pas le partager.</p>
<p style="margin:0;font-size:13px;color:#555;">Une question ? Répondez à cet e-mail ou appelez le +213 560 58 29 59.</p>
</td></tr>
<tr><td style="background:#f2f4f3;padding:16px 32px;font-size:12px;color:#777;">Aymen Promotion — www.aymenpromotion-dz.com</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html };
}

// Génère le badge et l'envoie par e-mail. Ne lève jamais : renvoie { sent, reason? }
// pour que l'inscription (déjà enregistrée en base) ne soit pas perdue si le SMTP tombe.
async function sendBadgeEmail(reg) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[batimat-after] SMTP non configuré — badge non envoyé.');
    return { sent: false, reason: 'smtp_not_configured' };
  }
  try {
    const pdf = await generateBadgePdf(reg);
    const { subject, text, html } = buildEmail(reg);
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || 'contact@aymenpromotion.com',
      envelope: process.env.SMTP_ENVELOPE_FROM
        ? { from: process.env.SMTP_ENVELOPE_FROM, to: reg.email }
        : undefined,
      to: reg.email,
      subject,
      text,
      html,
      attachments: [
        { filename: 'badge-aymen-promotion-paris.pdf', content: pdf, contentType: 'application/pdf' },
      ],
    });
    console.log(
      `[batimat-after] badge accepté par le SMTP pour ${reg.email} — accepté: ${JSON.stringify(info.accepted)}, rejeté: ${JSON.stringify(info.rejected)}, réponse: ${info.response}, id: ${info.messageId}`
    );
    return { sent: true };
  } catch (err) {
    console.error('[batimat-after] Échec envoi badge:', err.message);
    return { sent: false, reason: 'send_error' };
  }
}

module.exports = { sendBadgeEmail };
