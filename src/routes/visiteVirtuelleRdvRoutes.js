const express = require('express');
const router = express.Router();
const visiteVirtuelleRdvController = require('../controllers/visiteVirtuelleRdvController');

router.post('/', visiteVirtuelleRdvController.createLead);
router.get('/', visiteVirtuelleRdvController.getAllLeads);

module.exports = router;
