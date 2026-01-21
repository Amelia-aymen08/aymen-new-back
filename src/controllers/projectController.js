const db = require('../models');
const Project = db.Project;
const ProjectImage = db.ProjectImage;

// Create a new Project
exports.createProject = async (req, res) => {
  try {
    const { title, slug, description, status, type, address, latitude, longitude, features, deliveryDate, localityId } = req.body;
    
    // Check if file is uploaded
    const coverImage = req.file ? req.file.path : null;

    const project = await Project.create({
      title,
      slug,
      description,
      status,
      type,
      address,
      latitude,
      longitude,
      features: features ? JSON.parse(features) : [],
      deliveryDate,
      localityId,
      coverImage
    });

    res.send(project);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while creating the Project."
    });
  }
};

// Retrieve all Projects
exports.findAllProjects = async (req, res) => {
  try {
    const projects = await Project.findAll({
      include: ["locality", "images"]
    });
    res.send(projects);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving projects."
    });
  }
};

// Find a single Project with an id
exports.findOneProject = async (req, res) => {
  const id = req.params.id;

  try {
    const project = await Project.findByPk(id, {
      include: ["locality", "images"]
    });

    if (project) {
      res.send(project);
    } else {
      res.status(404).send({
        message: `Cannot find Project with id=${id}.`
      });
    }
  } catch (err) {
    res.status(500).send({
      message: "Error retrieving Project with id=" + id
    });
  }
};

// Update a Project by the id in the request
exports.updateProject = async (req, res) => {
  const id = req.params.id;

  try {
    const [num] = await Project.update(req.body, {
      where: { id: id }
    });

    if (num == 1) {
      res.send({
        message: "Project was updated successfully."
      });
    } else {
      res.send({
        message: `Cannot update Project with id=${id}. Maybe Project was not found or req.body is empty!`
      });
    }
  } catch (err) {
    res.status(500).send({
      message: "Error updating Project with id=" + id
    });
  }
};

// Delete a Project with the specified id in the request
exports.deleteProject = async (req, res) => {
  const id = req.params.id;

  try {
    const num = await Project.destroy({
      where: { id: id }
    });

    if (num == 1) {
      res.send({
        message: "Project was deleted successfully!"
      });
    } else {
      res.send({
        message: `Cannot delete Project with id=${id}. Maybe Project was not found!`
      });
    }
  } catch (err) {
    res.status(500).send({
      message: "Could not delete Project with id=" + id
    });
  }
};
