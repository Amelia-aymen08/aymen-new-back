const express = require('express');
const catalog = require('../../controllers/mobile/catalogController');
const auth = require('../../controllers/mobile/authController');
const me = require('../../controllers/mobile/meController');
const leads = require('../../controllers/mobile/leadsController');
const appointments = require('../../controllers/mobile/appointmentsController');
const events = require('../../controllers/mobile/eventsController');
const { requireMobileAuth } = require('../../middleware/mobileAuth');

const router = express.Router();

// Public
router.get('/bootstrap', catalog.bootstrap);
router.get('/home', catalog.home);
router.get('/projects', catalog.listProjects);
router.get('/projects/map', catalog.projectsMap);
router.get('/projects/:id', catalog.getProject);
router.get('/localities', catalog.listLocalities);
router.get('/localities/:id', catalog.getLocality);
router.get('/contact-options', catalog.contactOptions);
router.get('/appointment-slots', appointments.listSlots);

router.post('/auth/otp/request', auth.requestOtp);
router.post('/auth/otp/verify', auth.verifyOtp);
router.post('/auth/refresh', auth.refresh);
router.post('/auth/logout', auth.logout);

router.post('/leads', leads.createContactLead);
router.post('/callbacks', leads.createCallbackLead);
router.post('/brochure-requests', leads.createBrochureLead);

// Authentifié
router.get('/me', requireMobileAuth, me.getMe);
router.patch('/me', requireMobileAuth, me.patchMe);
router.get('/me/interests', requireMobileAuth, me.getInterests);
router.put('/me/interests', requireMobileAuth, me.putInterests);
router.get('/me/favorites', requireMobileAuth, me.listFavorites);
router.put('/me/favorites/:projectId', requireMobileAuth, me.putFavorite);
router.delete('/me/favorites/:projectId', requireMobileAuth, me.deleteFavorite);
router.post('/me/favorites/merge', requireMobileAuth, me.mergeFavorites);
router.get('/me/consents', requireMobileAuth, me.getConsents);
router.put('/me/consents', requireMobileAuth, me.putConsents);
router.post('/me/deletion', requireMobileAuth, me.requestDeletion);
router.get('/me/notifications', requireMobileAuth, me.listNotifications);
router.patch('/me/notifications/:id', requireMobileAuth, me.markNotificationRead);
router.put('/me/devices/:id', requireMobileAuth, me.upsertDevice);

router.post('/appointments', requireMobileAuth, appointments.createAppointment);
router.get('/me/appointments', requireMobileAuth, appointments.listMyAppointments);
router.get('/appointments/:id', requireMobileAuth, appointments.getAppointment);
router.patch('/appointments/:id', requireMobileAuth, appointments.updateAppointment);
router.post('/appointments/:id/cancel', requireMobileAuth, appointments.cancelAppointment);
router.get('/appointments/:id/calendar', requireMobileAuth, appointments.getAppointmentCalendar);

router.post('/events/batch', events.batch);

module.exports = router;
