const db = require('../models');
const Candidate = db.Candidate;

exports.createCandidate = async (req, res) => {
  try {
    console.log("🔍 [Candidate] Données reçues dans le body:", req.body);
    console.log("🔍 [Candidate] Fichier reçu:", req.file);

    const { 
      firstName, lastName, email, phone, department, position, portfolioUrl, message,
      city, erp, bim, software, experience, diploma, startDate, mobility, motivation, source, consent
    } = req.body;

    const cvPath = req.file ? req.file.path : null;
    
    // Basic validation
    if (!firstName || !lastName || !email || !position || consent === undefined) {
      console.log("❌ [Candidate] Validation échouée: champs manquants");
      return res.status(400).send({
        message: "Les champs obligatoires (Nom, Prénom, Email, Poste, Consentement) doivent être remplis !"
      });
    }

    // Create a Candidate
    const candidate = {
      firstName,
      lastName,
      email,
      phone,
      department: department || 'Candidature Spontanée',
      position,
      city,
      erp,
      bim,
      software,
      experience,
      diploma,
      startDate,
      mobility,
      motivation,
      source,
      consent: consent === 'true' || consent === true,
      portfolioUrl,
      message,
      cvPath,
    };

    console.log("📝 [Candidate] Objet à insérer dans la BDD:", candidate);

    // Save Candidate in the database
    const data = await Candidate.create(candidate);
    
    console.log("✅ [Candidate] Inséré avec succès:", data.toJSON());
    
    res.status(201).send({
      message: "Candidature envoyée avec succès !",
      data: data
    });
  } catch (err) {
    console.error("❌ [Candidate] Erreur:", err);
    res.status(500).send({
      message: err.message || "Une erreur est survenue lors de l'envoi de la candidature."
    });
  }
};

exports.findAll = async (req, res) => {
  try {
    const data = await Candidate.findAll();
    res.send(data);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Une erreur est survenue lors de la récupération des candidats."
    });
  }
};
