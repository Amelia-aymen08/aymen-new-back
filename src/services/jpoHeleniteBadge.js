const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Modèle du badge fourni par le design (image A5 à plat, 297 x 422 pt). On dessine par-dessus :
//  - dans le carré blanc à gauche : le QR code (il porte l'identifiant, le prénom et le nom) ;
//  - à droite : prénom / NOM au-dessus de « Créneaux sélectionnés », puis le jour sous
//    « Créneaux sélectionnés : » et l'horaire sous « Heures : ».
const TEMPLATE_PATH =
  process.env.BADGE_JPO_HELENITE_TEMPLATE_PATH ||
  path.join(__dirname, '..', '..', 'assets', 'badge_helenite_jpo.pdf');

// Positions en points PDF, origine en haut à gauche (converties plus bas).
// Carré blanc : x 39-129, y 263-353.
const LAYOUT = {
  qr: { centerX: 84, top: 276, size: 64 },
  right: { x: 137, maxWidth: 140 },
  name: { firstBaseline: 258, lineHeight: 15, maxSize: 13, minSize: 7 },
  // Les libellés du modèle sont à ~299,5 (« Créneaux sélectionnés ») et ~326 (« Heures »).
  dateValue: { baseline: 313, size: 10.5 },
  timeValue: { baseline: 339.5, size: 10.5 },
};

const DARK = rgb(0.1, 0.1, 0.1);
const BRAND = rgb(0.55, 0.09, 0.35);

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

// « 2026-10-23 » → « Vendredi 23 octobre 2026 » (calculé en UTC : pas de décalage de fuseau).
function formatVisitDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const day = DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${d} octobre ${y}`;
}

// Les polices standard PDF n'encodent que le latin (WinAnsi) : on retire les
// diacritiques puis les caractères non supportés plutôt que de faire échouer l'envoi.
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

// Contenu du QR : préfixe + identifiant d'inscription + prénom + nom.
function buildQrPayload({ id, firstName, lastName }) {
  const clean = (v) => String(v || '').replace(/[|\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
  return `AYMEN-JPO26|${id}|${clean(firstName)}|${clean(lastName)}`;
}

async function generateBadgePdf(registration) {
  const { firstName, lastName, visitDate, timeSlot } = registration;
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

  // Texte aligné à gauche, réduit jusqu'à tenir dans la colonne de droite.
  const drawLine = (rawText, baseline, maxSize, minSize, color) => {
    const text = toSupportedText(bold, rawText);
    let size = maxSize;
    while (size > minSize && bold.widthOfTextAtSize(text, size) > LAYOUT.right.maxWidth) size -= 0.25;
    page.drawText(text, { x: LAYOUT.right.x, y: pageHeight - baseline, size, font: bold, color });
  };

  drawLine(firstName, LAYOUT.name.firstBaseline, LAYOUT.name.maxSize, LAYOUT.name.minSize, BRAND);
  drawLine(
    String(lastName).toUpperCase(),
    LAYOUT.name.firstBaseline + LAYOUT.name.lineHeight,
    LAYOUT.name.maxSize,
    LAYOUT.name.minSize,
    BRAND,
  );
  drawLine(formatVisitDate(visitDate), LAYOUT.dateValue.baseline, LAYOUT.dateValue.size, 7, DARK);
  drawLine(timeSlot, LAYOUT.timeValue.baseline, LAYOUT.timeValue.size, 7, DARK);

  return Buffer.from(await pdf.save());
}

module.exports = { generateBadgePdf, buildQrPayload, formatVisitDate };
