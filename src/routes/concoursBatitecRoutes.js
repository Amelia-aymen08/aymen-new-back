const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const controller = require('../controllers/concoursBatitecController');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'concours-batitec');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const ext = path.extname(file.originalname || '');
    const base = path.basename(file.originalname || 'file', ext);
    cb(null, `${ts}-${sanitizeFileName(base)}${sanitizeFileName(ext)}`);
  },
});

const allowedMimes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimes.has(file.mimetype)) return cb(null, true);
    return cb(new Error('Format de fichier non accepté.'));
  },
});

router.post('/applications', upload.single('studentCard'), controller.createApplication);
router.get('/applications', controller.listApplications);

module.exports = router;
