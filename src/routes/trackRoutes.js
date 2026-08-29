const express = require('express');
const router = express.Router();
const trackController = require('../controllers/trackController');
const requireTrackingToken = require('../middleware/requireTrackingToken');

router.post('/scan', trackController.recordScan);
router.get('/stats', requireTrackingToken(), trackController.getStats);

module.exports = router;
