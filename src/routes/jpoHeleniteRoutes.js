const express = require('express');
const router = express.Router();
const controller = require('../controllers/jpoHeleniteController');
const leadsAdmin = require('../controllers/jpoLeadsAdminController');
const requireDashboardToken = require('../middleware/requireDashboardToken');

const requireDashboard = requireDashboardToken(['JPO_DASHBOARD_TOKEN', 'BATIMAT_DASHBOARD_TOKEN']);

router.post('/', controller.createRegistration);
router.post('/draft', controller.saveDraft);
router.get('/', requireDashboard, controller.getAll);
router.get('/drafts', requireDashboard, controller.getDrafts);
// Prospects et comptes des commerciaux (application de scan) — dashboard web.
router.get('/admin/overview', requireDashboard, leadsAdmin.overview);
router.patch('/admin/leads/:id', requireDashboard, leadsAdmin.updateLead);
router.post('/admin/agents', requireDashboard, leadsAdmin.createAgent);
router.patch('/admin/agents/:id', requireDashboard, leadsAdmin.updateAgent);
router.post('/admin/agents/:id/reset-password', requireDashboard, leadsAdmin.resetPassword);
router.get('/link-stats', requireDashboard, controller.getLinkStats);
router.patch('/:id/status', requireDashboard, controller.updateStatus);
router.post('/:id/resend-badge', requireDashboard, controller.resendBadge);

module.exports = router;
