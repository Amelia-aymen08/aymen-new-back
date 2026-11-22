const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const auth = require('../controllers/adminAuthController');
const blogAdmin = require('../controllers/blogAdminController');
const catalogAdmin = require('../controllers/catalogAdminController');
const { requireAdmin, requireAdminRole } = require('../middleware/requireAdmin');

// Images du dashboard : uploads/<dossier>/<aléatoire>.<ext>, images uniquement, 8 Mo max.
// ?folder=blog (défaut) | projects | localities
const UPLOAD_FOLDERS = ['blog', 'projects', 'localities'];
for (const f of UPLOAD_FOLDERS) fs.mkdirSync(path.join('uploads', f), { recursive: true });
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };
const uploadFolder = (req) => (UPLOAD_FOLDERS.includes(req.query.folder) ? req.query.folder : 'blog');

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join('uploads', uploadFolder(req))),
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

// Projets et localités. La suppression est réservée aux administrateurs (les éditeurs peuvent masquer).
router.get('/projects', catalogAdmin.listProjects);
router.get('/projects/:id', catalogAdmin.getProject);
router.post('/projects', catalogAdmin.createProject);
router.put('/projects/:id', catalogAdmin.updateProject);
router.patch('/projects/:id', catalogAdmin.patchProject);
router.delete('/projects/:id', requireAdminRole, catalogAdmin.removeProject);

router.get('/localities', catalogAdmin.listLocalities);
router.get('/localities/:id', catalogAdmin.getLocality);
router.post('/localities', catalogAdmin.createLocality);
router.put('/localities/:id', catalogAdmin.updateLocality);
router.delete('/localities/:id', requireAdminRole, catalogAdmin.removeLocality);

router.post('/uploads', (req, res) => {
  imageUpload.single('file')(req, res, (err) => {
    if (err) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({ message: tooBig ? 'Image trop lourde (8 Mo maximum).' : "Échec de l'envoi de l'image." });
    }
    if (!req.file) return res.status(400).json({ message: 'Aucune image reçue (formats acceptés : JPG, PNG, WebP, GIF, AVIF).' });
    return res.status(201).json({ url: `/uploads/${uploadFolder(req)}/${req.file.filename}` });
  });
});

router.post('/translate', blogAdmin.translate);

module.exports = router;
