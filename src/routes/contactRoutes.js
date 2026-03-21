const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const multer = require('multer');
const fs = require('fs');

// Configurer multer pour les pièces jointes des contacts
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/contacts';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Limite à 5MB
});

router.post('/', upload.single('attachment'), contactController.createContact);
router.get('/', contactController.getAllContacts);

module.exports = router;
