const express = require('express');
const router = express.Router();
const controller = require('../controllers/jpoNiceController');
const leadsAdmin = require('../controllers/jpoNiceLeadsAdminController');
const requireDashboardToken = require('../middleware/requireDashboardToken');

const requireDashboard = requireDashboardToken(['JPO_DASHBOARD_TOKEN', 'BATIMAT_DASHBOARD_TOKEN']);

router.post('/', controller.createRegistration);
router.get('/', requireDashboard, controller.getAll);
// Prospects et comptes de l'application de scan JPO Nice — dashboard web.
router.get('/admin/overview', requireDashboard, leadsAdmin.overview);
router.patch('/admin/leads/:id', requireDashboard, leadsAdmin.updateLead);
router.post('/admin/agents', requireDashboard, leadsAdmin.createAgent);
router.patch('/admin/agents/:id', requireDashboard, leadsAdmin.updateAgent);
router.post('/admin/agents/:id/reset-password', requireDashboard, leadsAdmin.resetPassword);
router.get('/link-stats', requireDashboard, controller.getLinkStats);
router.patch('/:id/status', requireDashboard, controller.updateStatus);
router.post('/:id/resend-badge', requireDashboard, controller.resendBadge);

module.exports = router;
