const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Modèle du badge fourni par le design (image A4 à plat). On dessine par-dessus,
// dans le carré blanc : le QR code, puis le prénom et le nom du visiteur.
const TEMPLATE_PATH =
  process.env.BADGE_AFTER_TEMPLATE_PATH || path.join(__dirname, '..', '..', 'assets', 'badge_after.pdf');

const VISIT_DAYS = {
  samedi: { label: 'Samedi 3 octobre' },
  dimanche: { label: 'Dimanche 4 octobre' },
  flexible: { label: 'Samedi 3 ou dimanche 4 octobre' },
};

// Positions en points PDF, origine en haut à gauche (converties plus bas).
// Page A4 : 595 x 842 pt. Carré blanc : x 98-196, y 242-339.
const LAYOUT = {
  qr: { centerX: 147, top: 248, size: 64 },
  name: { centerX: 147, firstBaseline: 324, lineHeight: 10, maxWidth: 86, maxSize: 9, minSize: 5.5 },
};

const DARK = rgb(0.1, 0.1, 0.1);

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

// Contenu du QR : préfixe + jeton unique + nom et prénom. Le jeton identifie la
// personne sans ambiguïté (deux « Karim Benali » restent distincts) pour l'app de scan.
function buildQrPayload({ qrToken, firstName, lastName }) {
  const clean = (v) => String(v || '').replace(/[|\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
  return `AYMEN-BA26|${qrToken}|${clean(firstName)}|${clean(lastName)}`;
}

async function generateBadgePdf(registration) {
  const { firstName, lastName } = registration;
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

  // Prénom puis NOM, chacun sur sa ligne, réduits jusqu'à tenir dans le carré.
  const lines = [toSupportedText(bold, firstName), toSupportedText(bold, String(lastName).toUpperCase())];
  lines.forEach((text, i) => {
    let size = LAYOUT.name.maxSize;
    while (size > LAYOUT.name.minSize && bold.widthOfTextAtSize(text, size) > LAYOUT.name.maxWidth) {
      size -= 0.25;
    }
    const width = bold.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: LAYOUT.name.centerX - Math.min(width, LAYOUT.name.maxWidth) / 2,
      y: pageHeight - (LAYOUT.name.firstBaseline + i * LAYOUT.name.lineHeight),
      size,
      font: bold,
      color: DARK,
    });
  });

  return Buffer.from(await pdf.save());
}

module.exports = { generateBadgePdf, buildQrPayload, VISIT_DAYS };
