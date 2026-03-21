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

// Créer un middleware pour gérer les erreurs multer et forcer le parsing
const handleUpload = (req, res, next) => {
  console.log("📥 [CONTACT ROUTE] Nouvelle requête reçue !");
  console.log("Headers:", req.headers['content-type']);
  
  const uploadMiddleware = upload.single('attachment');
  
  uploadMiddleware(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      console.error("❌ [MULTER ERROR]:", err);
      return res.status(400).json({ message: 'Erreur lors du téléchargement du fichier', error: err.message });
    } else if (err) {
      console.error("❌ [UNKNOWN ERROR]:", err);
      return res.status(500).json({ message: 'Erreur serveur lors du téléchargement', error: err.message });
    }
    
    console.log("✅ [MULTER PARSING OK]");
    console.log("➡️ req.body:", req.body);
    console.log("➡️ req.file:", req.file ? req.file.originalname : "Aucun fichier");

    // Si req.body est toujours vide après multer, on log pour comprendre
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error("⚠️ Multer a traité la requête mais req.body est vide. Vérifiez que le frontend envoie bien du multipart/form-data.");
    }
    
    next();
  });
};

router.post('/', handleUpload, contactController.createContact);
router.get('/', contactController.getAllContacts);

module.exports = router;
