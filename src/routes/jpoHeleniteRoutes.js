const express = require('express');
const router = express.Router();
const controller = require('../controllers/jpoHeleniteController');
const requireDashboardToken = require('../middleware/requireDashboardToken');

const requireDashboard = requireDashboardToken(['JPO_DASHBOARD_TOKEN', 'BATIMAT_DASHBOARD_TOKEN']);

router.post('/', controller.createRegistration);
router.post('/draft', controller.saveDraft);
router.get('/', requireDashboard, controller.getAll);
router.get('/drafts', requireDashboard, controller.getDrafts);
router.get('/link-stats', requireDashboard, controller.getLinkStats);
router.patch('/:id/status', requireDashboard, controller.updateStatus);
router.post('/:id/resend-badge', requireDashboard, controller.resendBadge);

module.exports = router;
