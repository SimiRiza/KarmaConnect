import * as ngoService from '../services/ngoService.js';

export const getProfile = async (req, res, next) => {
  try {
    const data = await ngoService.getNgoProfile(req.user.id);
    res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const data = await ngoService.updateNgoProfile(req.user.id, req.body);
    res.status(200).json({
      success: true,
      message: 'NGO profile updated successfully.',
      ...data
    });
  } catch (error) {
    next(error);
  }
};

export const getUnadoptedProblems = async (req, res, next) => {
  try {
    const result = await ngoService.getUnadoptedProblems(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const adoptProblem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await ngoService.adoptProblem(req.user.id, id, req.body);
    res.status(201).json({
      success: true,
      message: 'Problem successfully adopted and converted to managed project.',
      ...result
    });
  } catch (error) {
    next(error);
  }
};

export const createProject = async (req, res, next) => {
  try {
    const project = await ngoService.createDirectProject(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Project created successfully.',
      project
    });
  } catch (error) {
    next(error);
  }
};

export const getProjects = async (req, res, next) => {
  try {
    const projects = await ngoService.getNgoProjects(req.user.id, req.query);
    res.status(200).json({
      success: true,
      count: projects.length,
      projects
    });
  } catch (error) {
    next(error);
  }
};

export const getProjectById = async (req, res, next) => {
  try {
    const project = await ngoService.getProjectById(req.user.id, req.params.id);
    res.status(200).json({
      success: true,
      project
    });
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    const project = await ngoService.updateProject(req.user.id, req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Project updated successfully.',
      project
    });
  } catch (error) {
    next(error);
  }
};

export const updateProjectStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }
    const project = await ngoService.updateProjectStatus(req.user.id, req.params.id, status);
    res.status(200).json({
      success: true,
      message: `Project status updated to ${project.status}.`,
      project
    });
  } catch (error) {
    next(error);
  }
};

export const getApplicants = async (req, res, next) => {
  try {
    const applicants = await ngoService.getProjectApplicants(req.user.id, req.params.id);
    res.status(200).json({
      success: true,
      count: applicants.length,
      applicants
    });
  } catch (error) {
    next(error);
  }
};

export const reviewApplicant = async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await ngoService.reviewApplication(req.user.id, req.params.id, status);
    res.status(200).json({
      success: true,
      message: `Application marked as ${status}.`,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

export const updateResources = async (req, res, next) => {
  try {
    const project = await ngoService.updateProjectResources(req.user.id, req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Project resources updated successfully.',
      project
    });
  } catch (error) {
    next(error);
  }
};

export const uploadPhotos = async (req, res, next) => {
  try {
    const { category } = req.body;
    let urls = [];
    if (req.files && req.files.length > 0) {
      urls = req.files.map((file) => `/uploads/${file.filename}`);
    } else if (Array.isArray(req.body.urls)) {
      urls = req.body.urls;
    }

    if (!category || urls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Category and at least one image photo is required.'
      });
    }

    const project = await ngoService.uploadProjectPhotos(req.user.id, req.params.id, category, urls);
    res.status(200).json({
      success: true,
      message: 'Photos uploaded successfully.',
      photos: project.photos
    });
  } catch (error) {
    next(error);
  }
};

export const completeProject = async (req, res, next) => {
  try {
    const project = await ngoService.completeProject(req.user.id, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Project successfully marked as completed! Impact statistics updated.',
      project
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardSummary = async (req, res, next) => {
  try {
    const userCity = req.user.location?.city || '';
    const summary = await ngoService.getDashboardSummary(req.user.id, userCity);
    res.status(200).json({
      success: true,
      summary
    });
  } catch (error) {
    next(error);
  }
};
