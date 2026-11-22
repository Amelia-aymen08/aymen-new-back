const upload = require('../config/multer');
const { requireAdmin, requireAdminRole } = require('../middleware/requireAdmin');

// Ancienne API projets. La lecture reste publique (ancien site, page localité) ;
// l'écriture est réservée aux administrateurs : le dashboard passe désormais par /api/admin/projects.
module.exports = app => {
  const projects = require('../controllers/projectController.js');
  var router = require('express').Router();

  router.post('/', requireAdmin, requireAdminRole, upload.single('coverImage'), projects.createProject);

  // Retrieve all Projects
  router.get('/', projects.findAllProjects);

  // Retrieve a single Project with id
  router.get('/:id', projects.findOneProject);

  router.put('/:id', requireAdmin, requireAdminRole, projects.updateProject);

  router.delete('/:id', requireAdmin, requireAdminRole, projects.deleteProject);

  app.use('/api/projects', router);
};
