const db = require('../models');
const Candidate = db.Candidate;

exports.createCandidate = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, department, position, portfolioUrl } = req.body;
    
    // Basic validation
    if (!firstName || !lastName || !email || !department || !position) {
      return res.status(400).send({
        message: "Content can not be empty!"
      });
    }

    // Create a Candidate
    const candidate = {
      firstName,
      lastName,
      email,
      phone,
      department,
      position,
      portfolioUrl,
      // cvPath will be handled by multer middleware later
    };

    // Save Candidate in the database
    const data = await Candidate.create(candidate);
    res.send(data);
  } catch (err) {
    res.status(500).send({
      message:
        err.message || "Some error occurred while creating the Candidate."
    });
  }
};

exports.findAll = async (req, res) => {
  try {
    const data = await Candidate.findAll();
    res.send(data);
  } catch (err) {
    res.status(500).send({
      message:
        err.message || "Some error occurred while retrieving candidates."
    });
  }
};
