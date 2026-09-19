import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { discoverProblems } from '../services/problemDiscovery.js';
import Problem from '../models/Problem.js';
import Application from '../models/Application.js';
import Contribution from '../models/Contribution.js';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
const sanitizeLocation = (location) => {
  if (!location) return { city: '', area: '' };
  const { coordinates, ...safeLocation } = location;
  return safeLocation;
};

const sanitizeProblem = (problem) => {
  if (!problem) return null;
  const plain = problem.toObject ? problem.toObject() : { ...problem };
  if (plain.location) plain.location = sanitizeLocation(plain.location);
  if (plain.postedBy && typeof plain.postedBy === 'object' && plain.postedBy._id) {
    plain.postedBy = plain.postedBy._id;
  }
  return plain;
};

const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
};

const validateProblemPayload = (payload) => {
  const errors = [];
  if (!payload.title || !String(payload.title).trim()) errors.push({ field: 'title', message: 'Title is required.' });
  if (String(payload.title || '').length > 100) errors.push({ field: 'title', message: 'Title cannot exceed 100 characters.' });
  if (!payload.description || !String(payload.description).trim()) errors.push({ field: 'description', message: 'Description is required.' });
  if (String(payload.description || '').length > 1000) errors.push({ field: 'description', message: 'Description cannot exceed 1000 characters.' });
  if (!payload.category || !['cleaning', 'repair', 'environment', 'education', 'elderly_support', 'animal_welfare', 'health', 'other'].includes(payload.category)) {
    errors.push({ field: 'category', message: 'Please select a valid category.' });
  }
  if (!payload.location || !payload.location.city || !String(payload.location.city).trim()) {
    errors.push({ field: 'location.city', message: 'Location city is required.' });
  }
  if (!payload.urgency || !['low', 'medium', 'high'].includes(payload.urgency)) {
    errors.push({ field: 'urgency', message: 'Urgency is required.' });
  }
  if (!Array.isArray(payload.photos) || payload.photos.length === 0) {
    errors.push({ field: 'photos', message: 'At least one photo URL is required.' });
  }
  if (Array.isArray(payload.photos) && payload.photos.some((photo) => typeof photo !== 'string' || (!/^https?:\/\//i.test(photo) && !/^\/uploads\/[\w.-]+$/.test(photo)))) {
    errors.push({ field: 'photos', message: 'Each photo must be a valid URL.' });
  }
  if (payload.location && Array.isArray(payload.location.coordinates) && payload.location.coordinates.length === 2) {
    const [lng, lat] = payload.location.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      errors.push({ field: 'location.coordinates', message: 'Coordinates must be numeric [lng, lat].' });
    }
  }
  return errors;
};

router.post('/upload', authenticate, authorize('community_user'), upload.array('photos', 6), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'Please upload at least one image.' });
  }

  const urls = req.files.map((file) => `/uploads/${file.filename}`);
  return res.status(200).json({ success: true, urls });
});

router.get('/', authenticate, authorize('community_user'), async (req, res, next) => {
  try {
    return res.status(200).json({ success: true, ...await discoverProblems(req.query) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, authorize('community_user'), async (req, res, next) => {
  try {
    const problem = await Problem.findById(req.params.id).populate('postedBy', 'name profilePhotoUrl location');
    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found.' });
    return res.status(200).json({ success: true, problem: sanitizeProblem(problem) });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, authorize('community_user'), async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      photos: Array.isArray(req.body.photos) ? req.body.photos : (Array.isArray(req.body.photoUrls) ? req.body.photoUrls : [])
    };

    const validationErrors = validateProblemPayload(payload);
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed. Please check your inputs.', errors: validationErrors });
    }

    const problem = await Problem.create({
      postedBy: req.user._id,
      title: payload.title.trim(),
      description: payload.description.trim(),
      category: payload.category,
      photos: payload.photos,
      location: {
        city: payload.location.city.trim(),
        area: payload.location.area ? payload.location.area.trim() : '',
        coordinates: Array.isArray(payload.location.coordinates) && payload.location.coordinates.length === 2
          ? [Number(payload.location.coordinates[0]), Number(payload.location.coordinates[1])]
          : [0, 0]
      },
      urgency: payload.urgency,
      estimatedResourcesNeeded: payload.estimatedResourcesNeeded ? String(payload.estimatedResourcesNeeded).trim() : '',
      status: 'reported'
    });

    return res.status(201).json({ success: true, message: 'Problem created.', problem: sanitizeProblem(problem) });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/apply', authenticate, authorize('community_user'), async (req, res, next) => {
  try {
    const { contributionType, relevantSkills, note } = req.body;
    const validTypes = ['time', 'skills', 'money', 'materials'];
    if (!validTypes.includes(contributionType)) {
      return res.status(400).json({ success: false, message: 'Invalid contribution type.' });
    }

    const problem = await Problem.findById(req.params.id);
    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found.' });

    const existing = await Application.findOne({ userId: req.user._id, problemId: problem._id });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already applied to this problem.' });
    }

    const application = await Application.create({
      userId: req.user._id,
      problemId: problem._id,
      contributionType,
      relevantSkills: normalizeStringArray(relevantSkills),
      note: note ? String(note).trim().slice(0, 500) : '',
      status: 'pending'
    });

    return res.status(201).json({ success: true, message: 'Application submitted.', application });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/applicants', authenticate, authorize('community_user'), async (req, res, next) => {
  try {
    const problem = await Problem.findById(req.params.id);
    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found.' });
    if (problem.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only view applicants for the problems you posted.' });
    }

    const applicants = await Application.find({ problemId: req.params.id })
      .populate('userId', 'name email profilePhotoUrl location')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, applicants });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/contribute', authenticate, authorize('community_user'), async (req, res, next) => {
  try {
    const { type, note, amount } = req.body;
    const validTypes = ['time', 'skills', 'money', 'materials'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Contribution type is invalid.' });
    }

    const problem = await Problem.findById(req.params.id);
    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found.' });

    const contribution = await Contribution.create({
      userId: req.user._id,
      problemId: problem._id,
      type,
      note: note ? String(note).trim().slice(0, 500) : '',
      amount: type === 'money' ? Number(amount || 0) : 0
    });

    return res.status(201).json({
      success: true,
      message: 'Contribution recorded successfully.',
      contribution
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/save', authenticate, authorize('community_user'), async (req, res, next) => {
  try {
    const problem = await Problem.findById(req.params.id);
    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found.' });

    const user = await User.findById(req.user._id);
    if (!user.savedProblems) user.savedProblems = [];
    if (!user.savedProblems.some((savedId) => savedId.toString() === problem._id.toString())) {
      user.savedProblems.push(problem._id);
      await user.save();
    }

    return res.status(200).json({ success: true, message: 'Problem saved.', saved: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/save', authenticate, authorize('community_user'), async (req, res, next) => {
  try {
    const problem = await Problem.findById(req.params.id);
    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found.' });

    const user = await User.findById(req.user._id);
    user.savedProblems = (user.savedProblems || []).filter((savedId) => savedId.toString() !== problem._id.toString());
    await user.save();

    return res.status(200).json({ success: true, message: 'Problem removed from saved list.', saved: false });
  } catch (error) {
    next(error);
  }
});

export default router;
