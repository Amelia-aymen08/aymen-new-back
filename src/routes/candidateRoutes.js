module.exports = app => {
  const candidates = require('../controllers/candidateController.js');
  var router = require('express').Router();

  // Create a new Candidate
  router.post('/', candidates.createCandidate);

  // Retrieve all Candidates
  router.get('/', candidates.findAll);

  app.use('/api/candidates', router);
};
