const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const multer = require('multer');
const fs = require('fs');

// Configuration de multer pour enregistrer les fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/contacts';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Nettoyer le nom du fichier
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, `${Date.now()}-${cleanFileName}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 Mo maximum
});

// Middleware propre pour gérer les erreurs multer
const uploadMiddleware = (req, res, next) => {
  const uploadSingle = upload.single('attachment');
  
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: "Le fichier est trop volumineux (Max 5 Mo)." });
    } else if (err) {
      return res.status(500).json({ message: "Erreur lors de l'upload du fichier." });
    }
    next();
  });
};

router.post('/', uploadMiddleware, contactController.createContact);
router.get('/', contactController.getAllContacts);

module.exports = router;
