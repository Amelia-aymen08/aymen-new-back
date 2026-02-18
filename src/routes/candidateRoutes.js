const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for CV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/cvs';
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
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'application/msword' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non supporté (PDF ou Word uniquement)'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = app => {
  const candidates = require('../controllers/candidateController.js');
  var router = require('express').Router();

  // Create a new Candidate with CV upload
  router.post('/', upload.single('cv'), candidates.createCandidate);

  // Retrieve all Candidates
  router.get('/', candidates.findAll);

  app.use('/api/candidates', router);
};
