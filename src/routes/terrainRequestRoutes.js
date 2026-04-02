const express = require('express');
const router = express.Router();
const terrainRequestController = require('../controllers/terrainRequestController');

router.post('/', terrainRequestController.createTerrainRequest);
router.get('/', terrainRequestController.findAll);

module.exports = router;
