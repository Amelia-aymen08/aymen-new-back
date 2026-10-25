'use strict';
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Badge « Nice, on arrive » : modèle fourni par le design (PDF 260 x 461 pt, fond image). On dessine par-dessus :
//  - le QR code (jeton + prénom + nom) dans le carré vitré ;
//  - « NOM PRÉNOM » en blanc sous le carré ;
//  - le créneau choisi sous l'intitulé « CRÉNEAUX SÉLECTIONNÉS : » (déjà imprimé dans le modèle).
// `badge_nice_web.pdf` = même modèle allégé (~1 Mo au lieu de 18 Mo) pour que l'e-mail reste envoyable ;
// à défaut, le modèle d'origine `badge_nice.pdf`.
const ASSETS = path.join(__dirname, '..', '..', 'assets');
const TEMPLATE_PATH =
  process.env.BADGE_JPO_NICE_TEMPLATE_PATH ||
  (fs.existsSync(path.join(ASSETS, 'badge_nice_web.pdf')) ? path.join(ASSETS, 'badge_nice_web.pdf') : path.join(ASSETS, 'badge_nice.pdf'));

// Points PDF, origine en haut à gauche (convertis plus bas). Carré vitré : x 76-181, y 213-316 ;
// intitulé « CRÉNEAUX SÉLECTIONNÉS » : y 367-377 ; bloc des dates imprimé à partir de y 404.
const LAYOUT = {
  qr: { centerX: 128.7, top: 226, size: 77 },
  maxWidth: 196,
  centerX: 129.8,
  name: { baseline: 350, maxSize: 15, minSize: 8 },
  slot: { baseline: 392, maxSize: 11, minSize: 6.5 },
};
const WHITE = rgb(1, 1, 1);

const DAY_LABELS = {
  samedi: 'Samedi 31 octobre',
  dimanche: 'Dimanche 1er novembre',
  flexible: 'Samedi 31 octobre ou dimanche 1er novembre',
};
const DAY_LABELS_SHORT = { flexible: 'Samedi 31 oct. ou dimanche 1er nov.' };
const TIME_LABELS = {
  matin: 'Matin',
  apres_midi: 'Après-midi',
  flexible: 'Horaire flexible',
  a_confirmer: 'Horaire à confirmer',
};

// « Samedi 31 octobre · Matin » (version longue pour l'e-mail, courte pour le badge).
function slotLabel(reg, { short = false } = {}) {
  const day = (short && DAY_LABELS_SHORT[reg.visitDay]) || DAY_LABELS[reg.visitDay] || '';
  const time = TIME_LABELS[reg.timePref] || '';
  return [day, time].filter(Boolean).join(' · ');
}

// Les polices standard PDF n'encodent que le latin (WinAnsi) : on retire les diacritiques puis les
// caractères non supportés plutôt que de faire échouer l'envoi.
function toSupportedText(font, value) {
  const supported = new Set(font.getCharacterSet());
  const out = [];
  for (const ch of String(value || '')) {
    if (supported.has(ch.codePointAt(0))) {
      out.push(ch);
      continue;
    }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out.push([...base].every((c) => supported.has(c.codePointAt(0))) ? base : '');
  }
  return out.join('').replace(/\s+/g, ' ').trim();
}

// Contenu du QR : préfixe + jeton unique + prénom + nom. Seul le jeton identifie la personne.
function buildQrPayload({ qrToken, firstName, lastName }) {
  const clean = (v) => String(v || '').replace(/[|\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
  return `AYMEN-NICE26|${qrToken}|${clean(firstName)}|${clean(lastName)}`;
}

async function generateBadgePdf(registration) {
  const pdf = await PDFDocument.load(fs.readFileSync(TEMPLATE_PATH));
  const page = pdf.getPage(0);
  const pageHeight = page.getHeight();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const qrPng = await QRCode.toBuffer(buildQrPayload(registration), {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 600,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  const qrImage = await pdf.embedPng(qrPng);
  page.drawImage(qrImage, {
    x: LAYOUT.qr.centerX - LAYOUT.qr.size / 2,
    y: pageHeight - LAYOUT.qr.top - LAYOUT.qr.size,
    width: LAYOUT.qr.size,
    height: LAYOUT.qr.size,
  });

  // Texte centré, réduit jusqu'à tenir dans la largeur du badge.
  const drawCentered = (rawText, spec) => {
    const text = toSupportedText(bold, rawText);
    if (!text) return;
    let size = spec.maxSize;
    while (size > spec.minSize && bold.widthOfTextAtSize(text, size) > LAYOUT.maxWidth) size -= 0.25;
    const width = Math.min(bold.widthOfTextAtSize(text, size), LAYOUT.maxWidth);
    page.drawText(text, { x: LAYOUT.centerX - width / 2, y: pageHeight - spec.baseline, size, font: bold, color: WHITE });
  };

  drawCentered(`${registration.lastName} ${registration.firstName}`.toUpperCase(), LAYOUT.name);
  drawCentered(slotLabel(registration, { short: true }), LAYOUT.slot);

  return Buffer.from(await pdf.save());
}

module.exports = { generateBadgePdf, buildQrPayload, slotLabel, DAY_LABELS, TIME_LABELS };
