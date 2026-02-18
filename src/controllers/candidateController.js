const db = require('../models');
const Candidate = db.Candidate;

exports.createCandidate = async (req, res) => {
  try {
    const { 
      firstName, lastName, email, phone, department, position, portfolioUrl, message
    } = req.body;

    const cvPath = req.file ? req.file.path : null;
    
    // Basic validation
    if (!firstName || !lastName || !email || !position) {
      return res.status(400).send({
        message: "Les champs obligatoires (Nom, Prénom, Email, Poste) doivent être remplis !"
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
      portfolioUrl,
      message,
      cvPath,
    };

    // Save Candidate in the database
    const data = await Candidate.create(candidate);
    res.status(201).send({
      message: "Candidature envoyée avec succès !",
      data: data
    });
  } catch (err) {
    console.error(err);
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
