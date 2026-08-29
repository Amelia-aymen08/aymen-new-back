const express = require('express');
const router = express.Router();
const trackController = require('../controllers/trackController');
const requireDashboardToken = require('../middleware/requireDashboardToken');

const requireStatsAuth = requireDashboardToken([
  'TRACKING_DASHBOARD_TOKEN',
  'BATIMAT_DASHBOARD_TOKEN',
]);

router.post('/scan', trackController.recordScan);
router.get('/stats', requireStatsAuth, trackController.getStats);

module.exports = router;
