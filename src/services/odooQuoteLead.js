const { resolveResidenceId } = require('../data/odooResidences');

// `locations` / `contactDays` : tableau (formulaire) ou chaîne JSON (colonne TEXT de la table quotes).
const asList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* chaîne simple */
    }
  }
  return value ? [String(value)] : [];
};

// Devis du site -> charge utile de l'endpoint Odoo /api/crm/lead (noms de champs Odoo).
function buildOdooLead(q) {
  return {
    residence_id: resolveResidenceId(q.sourceProject),
    nom: String(q.lastName || ''),
    prenom: String(q.firstName || ''),
    pays: String(q.country || ''),
    email: String(q.email || ''),
    telephone: String(q.phone || ''),
    budget_estime: String(q.budget || ''),
    wilaya: String(q.wilaya || ''),
    profession: String(q.profession || ''),
    type_financement: String(q.financing || ''),
    interesse_par: String(q.interest || ''),
    localisation_souhaitee: asList(q.locations).join(', '),
    jour_contact: asList(q.contactDays).join(', '),
    heure_contact: String(q.contactTime || ''),
    statut_projet: String(q.projectStatus || ''),
    projet: String(q.sourceProject || ''),
  };
}

module.exports = { buildOdooLead };
