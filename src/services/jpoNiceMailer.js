const nodemailer = require('nodemailer');
const { generateBadgePdf, slotLabel, DAY_LABELS, TIME_LABELS } = require('./jpoNiceBadge');

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

const SITE_URL = 'https://aymenpromotion-dz.com';
const VENUE = 'Sheraton Nice';
const ADDRESS = '480 Promenade des Anglais, 06200 Nice';
const ENTRANCE = 'Entrée via l’avenue des Grenouillères, côté Parc Phoenix';
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${VENUE} ${ADDRESS}`)}`;

function buildEmail(reg) {
  const name = escapeHtml(reg.firstName);
  const dayLabel = DAY_LABELS[reg.visitDay] || '';
  const timeLabel = TIME_LABELS[reg.timePref] || '';

  const subject = 'Votre badge — Nice, on arrive (31 octobre & 1er novembre 2026)';
  const text = [
    `Bonjour ${reg.firstName},`,
    '',
    'Merci pour votre inscription à la rencontre Aymen Promotion à Nice. Votre badge nominatif est en pièce jointe : présentez-le (imprimé ou sur votre téléphone) à l’accueil. Son QR code est personnel.',
    '',
    `Jour souhaité : ${dayLabel}`,
    `Préférence horaire : ${timeLabel}`,
    `Lieu : ${VENUE}, ${ADDRESS}`,
    `${ENTRANCE}.`,
    '',
    'Notre équipe vous confirmera les détails de votre créneau par e-mail ou par téléphone.',
    '',
    'Le badge étant nominatif, merci de faire une inscription distincte pour chaque personne qui vous accompagne.',
    '',
    'Aymen Promotion — +213 560 58 29 59 — www.aymenpromotion-dz.com',
  ].join('\n');

  const row = (label, value) =>
    `<tr><td style="padding:6px 0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8a8a8a;font-weight:bold;width:120px;vertical-align:top;">${label}</td>` +
    `<td style="padding:6px 0;font-size:15px;color:#1a1a1a;font-weight:bold;">${value}</td></tr>`;

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f2f4f3;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f3;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#015a4a;padding:26px 32px 0;">
<img src="${SITE_URL}/logo.png" alt="Aymen Promotion" width="150" style="display:block;border:0;height:auto;">
</td></tr>
<tr><td style="background:#015a4a;padding:22px 32px 30px;">
<p style="margin:0;color:#F7C66A;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;">Nice · Côte d’Azur · Rencontres privées</p>
<h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;line-height:1.3;text-transform:uppercase;">Nice, <span style="color:#F7C66A;">on arrive</span></h1>
</td></tr>
<tr><td style="height:4px;background:#F7C66A;line-height:4px;font-size:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 32px;font-size:15px;line-height:1.6;">
<p style="margin:0 0 14px;">Bonjour ${name},</p>
<p style="margin:0 0 14px;">Merci pour votre inscription : nous serons ravis de vous accueillir à Nice, les <strong>samedi 31 octobre et dimanche 1er novembre 2026</strong>, pour parler de votre projet immobilier en Algérie.</p>
<p style="margin:0 0 20px;">Votre <strong>badge nominatif</strong> est en pièce jointe : présentez-le, imprimé ou sur votre téléphone, à l’accueil. Son QR code est personnel, merci de ne pas le partager.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f7f5;border-left:4px solid #F7C66A;border-radius:8px;margin:0 0 20px;">
<tr><td style="padding:14px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row('Jour souhaité', escapeHtml(dayLabel))}
${row('Horaire', escapeHtml(timeLabel))}
${row('Lieu', `${escapeHtml(VENUE)}<br><span style="font-weight:normal;">${escapeHtml(ADDRESS)}</span>`)}
${row('Accès', `<span style="font-weight:normal;">${escapeHtml(ENTRANCE)}</span>`)}
</table>
</td></tr></table>
<p style="margin:0 0 20px;">Notre équipe vous confirmera les détails de votre créneau par e-mail ou par téléphone.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>
<td style="background:#BF0D0D;border-radius:6px;"><a href="${MAPS_URL}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;">Voir l’itinéraire</a></td>
</tr></table>
<p style="margin:0 0 10px;font-size:13px;color:#555;">Le badge étant nominatif, merci de faire une inscription distincte pour chaque personne qui vous accompagne.</p>
<p style="margin:0;font-size:13px;color:#555;">Une question ? Répondez à cet e-mail ou appelez le +213 560 58 29 59.</p>
</td></tr>
<tr><td style="background:#015a4a;padding:16px 32px;font-size:12px;color:#cfe3dd;">Aymen Promotion — <a href="${SITE_URL}" style="color:#F7C66A;text-decoration:none;">www.aymenpromotion-dz.com</a></td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html };
}

// Génère le badge et l'envoie par e-mail. Ne lève jamais : renvoie { sent, reason? } pour que
// l'inscription (déjà enregistrée en base) ne soit pas perdue si le SMTP tombe.
async function sendBadgeEmail(reg) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[jpo-nice] SMTP non configuré — badge non envoyé.');
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
      attachments: [{ filename: 'badge-nice-aymen-promotion.pdf', content: pdf, contentType: 'application/pdf' }],
    });
    console.log(
      `[jpo-nice] badge accepté par le SMTP pour ${reg.email} — accepté: ${JSON.stringify(info.accepted)}, rejeté: ${JSON.stringify(info.rejected)}, id: ${info.messageId}`
    );
    return { sent: true };
  } catch (err) {
    console.error('[jpo-nice] Échec envoi badge:', err.message);
    return { sent: false, reason: 'send_error' };
  }
}

module.exports = { sendBadgeEmail, buildEmail, slotLabel };
