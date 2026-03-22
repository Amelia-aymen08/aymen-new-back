const express = require('express');
const router = express.Router();
const homeContactController = require('../controllers/homeContactController');

router.post('/', homeContactController.createHomeContact);
router.get('/', homeContactController.getAllHomeContacts);

module.exports = router;
