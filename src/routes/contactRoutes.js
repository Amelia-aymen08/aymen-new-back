const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

// Plus besoin de multer ici, on reçoit tout en JSON (le fichier est en Base64)
router.post('/', contactController.createContact);
router.get('/', contactController.getAllContacts);

module.exports = router;
