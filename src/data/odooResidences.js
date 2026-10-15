// Id des résidences dans le CRM Odoo (champ residence_id). Identiques aux `id` de
// frontend/src/data/mockData.ts — source : odoo_mappings.py (RESIDENCE_MAPPING).
const RESIDENCE_IDS = {
  'CYANITE': 1, 'AZURITE': 2, 'AGATE': 3, 'AMETRINE': 4, 'CORNALINE': 5,
  'SERAPHINITE': 6, 'CELESTINE': 7, 'LARIMAR': 8, 'SELENITE': 9,
  'DIAR EL AMANE': 10, 'PYRITE': 11, 'JAIS': 12, 'LES CRETES': 13,
  'TURQUOISE': 14, 'BOIS DES CARS': 17, 'PERIDOT': 18, 'CORAIL': 19,
  'OPALE': 20, 'CITRINE': 21, 'ANGELITE': 22, 'RUBIS': 23, 'ONYX': 24,
  'EL MORDJANE': 25, 'AYMEN': 26, 'COQUELICOT': 27, 'PERLA': 28,
  'ALTHEA': 29, 'BERYL': 30, 'HELENITE': 31,
};

const normalize = (v) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/^\s*RESIDENCE\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

// « AZURITE », « RÉSIDENCE AZURITE », « Azurité »… → « 2 ». Un id déjà numérique est conservé.
// Titre inconnu : renvoie '' (Odoo n'accepte que des ids) — l'appelant journalise.
function resolveResidenceId(sourceProject) {
  const raw = String(sourceProject || '').trim();
  if (/^\d+$/.test(raw)) return raw;
  const id = RESIDENCE_IDS[normalize(raw)];
  return id ? String(id) : '';
}

module.exports = { resolveResidenceId };
