// API publique du catalogue pour le site Next.js : /api/site/...
const express = require('express');
const catalog = require('../controllers/catalogController');

const router = express.Router();

router.get('/projects', catalog.listProjects);
router.get('/projects/:slug', catalog.getProject);
router.get('/localities', catalog.listLocalities);
router.get('/localities/:slug', catalog.getLocality);
router.get('/catalog-index', catalog.index);

module.exports = router;
