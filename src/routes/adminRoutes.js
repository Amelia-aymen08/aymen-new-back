const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const auth = require('../controllers/adminAuthController');
const blogAdmin = require('../controllers/blogAdminController');
const { requireAdmin } = require('../middleware/requireAdmin');

// Images du blog : uploads/blog/<aléatoire>.<ext>, images uniquement, 8 Mo max.
const BLOG_UPLOAD_DIR = path.join('uploads', 'blog');
fs.mkdirSync(BLOG_UPLOAD_DIR, { recursive: true });
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };

const blogUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, BLOG_UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${IMAGE_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, Boolean(IMAGE_TYPES[file.mimetype])),
});

const router = express.Router();

router.post('/login', auth.login);

router.use(requireAdmin);
router.get('/me', auth.me);

router.get('/blog', blogAdmin.list);
router.get('/blog/:id', blogAdmin.get);
router.post('/blog', blogAdmin.create);
router.put('/blog/:id', blogAdmin.update);
router.delete('/blog/:id', blogAdmin.remove);

router.post('/uploads', (req, res, next) => {
  blogUpload.single('file')(req, res, (err) => {
    if (err) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({ message: tooBig ? 'Image trop lourde (8 Mo maximum).' : "Échec de l'envoi de l'image." });
    }
    return next();
  });
}, blogAdmin.upload);

router.post('/translate', blogAdmin.translate);

module.exports = router;
