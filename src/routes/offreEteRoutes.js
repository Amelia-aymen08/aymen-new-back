const express = require('express');
const router = express.Router();
const offreEteController = require('../controllers/offreEteController');

router.post('/', offreEteController.createLead);
router.get('/', offreEteController.getAllLeads);

module.exports = router;
