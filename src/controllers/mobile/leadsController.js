// Réutilise directement le modèle Contact et le pipeline HubSpot existants
// (cf. docs/decisions.md D5) au lieu de créer une table lead_requests séparée.
const db = require('../../models');
const { Contact } = db;
const { buildMessage, trackLeadInHubspot } = require('../../services/hubspotForms');

const KIND_TYPE = {
  contact: 'mobile_contact',
  callback: 'mobile_callback',
  brochure: 'mobile_brochure',
};

async function createLead(kind, req, res) {
  try {
    const { fullName, email, phone, message, projectId, projectTitle, consent } = req.body || {};
    const user = req.mobileUser || null;

    const contact = await Contact.create({
      fullName: fullName || user?.fullName || 'Prospect application mobile',
      email: email || user?.email,
      phone: phone || user?.phone,
      subject: projectTitle ? `Projet: ${projectTitle}` : 'Application mobile',
      message: message || `Demande "${kind}" depuis l'application mobile.`,
      type: KIND_TYPE[kind],
      consent: consent === true || consent === 'true',
    });

    try {
      await trackLeadInHubspot({
        kind: KIND_TYPE[kind],
        email: contact.email,
        phone: contact.phone,
        fullName: contact.fullName,
        message: buildMessage({
          title: `Application mobile — ${kind}`,
          lines: [projectId ? `Projet ID: ${projectId}` : '', message || ''],
        }),
        pageUri: 'mobile-app',
        pageName: `mobile-${kind}`,
      });
    } catch (e) {
      console.warn('[HubSpot] mobile lead submit failed:', e?.message || e);
    }

    res.status(201).json({ data: { id: contact.id, status: 'received' } });
  } catch (err) {
    console.error(`[mobile/leads/${kind}]`, err);
    res.status(500).json({ error: { code: 'LEAD_SUBMIT_FAILED', message: "Une erreur est survenue lors de l'envoi.", retryable: true } });
  }
}

exports.createContactLead = (req, res) => createLead('contact', req, res);
exports.createCallbackLead = (req, res) => createLead('callback', req, res);
exports.createBrochureLead = (req, res) => createLead('brochure', req, res);
