const express = require('express');
const router = express.Router();
const controller = require('../controllers/batimatAfterController');
const requireDashboardToken = require('../middleware/requireDashboardToken');

const requireDashboard = requireDashboardToken(['BATIMAT_DASHBOARD_TOKEN']);

router.post('/', controller.createRegistration);
router.get('/', requireDashboard, controller.getAll);
router.post('/:id/resend-badge', requireDashboard, controller.resendBadge);

module.exports = router;
