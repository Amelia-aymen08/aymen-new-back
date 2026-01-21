const upload = require('../config/multer');

module.exports = app => {
  const projects = require('../controllers/projectController.js');
  var router = require('express').Router();

  // Create a new Project with cover image
  router.post('/', upload.single('coverImage'), projects.createProject);

  // Retrieve all Projects
  router.get('/', projects.findAllProjects);

  // Retrieve a single Project with id
  router.get('/:id', projects.findOneProject);

  // Update a Project with id
  router.put('/:id', projects.updateProject);

  // Delete a Project with id
  router.delete('/:id', projects.deleteProject);

  app.use('/api/projects', router);
};
