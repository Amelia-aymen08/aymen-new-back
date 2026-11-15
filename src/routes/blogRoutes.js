const express = require('express');
const blog = require('../controllers/blogController');

// API publique du blog : /api/blog, /api/blog/:slug
const router = express.Router();
router.get('/', blog.list);
router.get('/:slug', blog.getBySlug);

module.exports = router;
module.exports.index = blog.index; // monté sur /api/blog-index
