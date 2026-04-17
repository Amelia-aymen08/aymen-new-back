const express = require('express');
const router = express.Router();
const controller = require('../controllers/batimatechController');
const requireBatimatechAuth = require('../middleware/requireBatimatechAuth');

router.post('/login', controller.login);
router.get('/me', requireBatimatechAuth, controller.me);
router.get('/projects', requireBatimatechAuth, controller.listProjects);
router.get('/slots', requireBatimatechAuth, controller.listBookedSlots);
router.post('/leads', requireBatimatechAuth, controller.createLead);

module.exports = router;
