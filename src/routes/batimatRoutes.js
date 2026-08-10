const express = require('express');
const router = express.Router();
const batimatController = require('../controllers/batimatController');

router.post('/', batimatController.createLead);
router.get('/', batimatController.getAllLeads);

module.exports = router;
