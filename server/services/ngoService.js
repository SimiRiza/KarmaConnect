import mongoose from 'mongoose';
import User from '../models/User.js';
import NGOProfile from '../models/NGOProfile.js';
import Problem from '../models/Problem.js';
import Project from '../models/Project.js';
import Application from '../models/Application.js';
import CommunityUserProfile from '../models/CommunityUserProfile.js';
import { runInTransaction } from '../utils/transactionHelper.js';

const STATUS_PIPELINE = [
  'reported',
  'adopted',
  'team_forming',
  'funding_needed',
  'in_progress',
  'completed'
];

/**
 * Get NGO Profile and account info.
 */
export const getNgoProfile = async (userId) => {
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) {
    const err = new Error('NGO user not found.');
    err.statusCode = 404;
    throw err;
  }

  let profile = await NGOProfile.findOne({ userId });
  if (!profile) {
    profile = await NGOProfile.create({
      userId,
      ngoName: user.name,
      registrationNumber: 'REG-PENDING'
    });
  }

  return { user, profile };
};

/**
 * Update NGO Profile details.
 * Note: verificationStatus CANNOT be updated by NGO (admin only).
 */
export const updateNgoProfile = async (userId, updateData) => {
  const {
    ngoName,
    about,
    causeAreas,
    locationsServed,
    contactPersonName,
    contactPhone,
    team,
    userLocation
  } = updateData;

  const profile = await NGOProfile.findOne({ userId });
  if (!profile) {
    const err = new Error('NGO profile not found.');
    err.statusCode = 404;
    throw err;
  }

  if (ngoName) profile.ngoName = String(ngoName).trim();
  if (about !== undefined) profile.about = String(about).trim();
  if (Array.isArray(causeAreas)) profile.causeAreas = causeAreas.filter(Boolean);
  if (Array.isArray(locationsServed)) profile.locationsServed = locationsServed.filter(Boolean);
  if (contactPersonName !== undefined) profile.contactPersonName = String(contactPersonName).trim();
  if (contactPhone !== undefined) profile.contactPhone = String(contactPhone).trim();
  if (Array.isArray(team)) {
    profile.team = team.map((member) => ({
      name: String(member.name || '').trim(),
      role: String(member.role || '').trim(),
      photoUrl: String(member.photoUrl || '').trim()
    })).filter((m) => m.name && m.role);
  }

  await profile.save();

  // Update user name/location if provided
  if (ngoName || userLocation) {
    const userUpdates = {};
    if (ngoName) userUpdates.name = String(ngoName).trim();
    if (userLocation) userUpdates.location = userLocation;
    await User.findByIdAndUpdate(userId, userUpdates);
  }

  const user = await User.findById(userId).select('-passwordHash');
  return { user, profile };
};

/**
 * List unadopted community problems ('reported' status).
 */
export const getUnadoptedProblems = async (query = {}) => {
  const {
    location,
    city,
    category,
    urgency,
    search,
    page = 1,
    limit = 10,
    sort = 'newest'
  } = query;

  const filter = {
    status: 'reported',
    adoptedByNgoId: null
  };

  const targetCity = city || location;
  if (targetCity) {
    filter['location.city'] = { $regex: String(targetCity).trim(), $options: 'i' };
  }
  if (category) filter.category = category;
  if (urgency) filter.urgency = urgency;
  if (search && String(search).trim()) {
    filter.$or = [
      { title: { $regex: String(search).trim(), $options: 'i' } },
      { description: { $regex: String(search).trim(), $options: 'i' } }
    ];
  }

  const parsedPage = Math.max(1, Number(page));
  const parsedLimit = Math.min(50, Math.max(1, Number(limit)));
  const skip = (parsedPage - 1) * parsedLimit;

  const sortOrder = sort === 'most_urgent' ? { urgency: -1, createdAt: -1 } : { createdAt: -1 };

  const [items, total] = await Promise.all([
    Problem.find(filter)
      .sort(sortOrder)
      .skip(skip)
      .limit(parsedLimit)
      .populate('postedBy', 'name profilePhotoUrl')
      .lean(),
    Problem.countDocuments(filter)
  ]);

  return {
    page: parsedPage,
    limit: parsedLimit,
    total,
    totalPages: Math.ceil(total / parsedLimit),
    items
  };
};

/**
 * Adopt a problem atomically:
 * Creates a linked Project and updates Problem status to 'adopted'.
 */
export const adoptProblem = async (ngoId, problemId, customData = {}) => {
  return await runInTransaction(async (session) => {
    const opts = session ? { session } : {};

    const problem = await Problem.findById(problemId).session(session || null);
    if (!problem) {
      const err = new Error('Problem not found.');
      err.statusCode = 404;
      throw err;
    }

    if (problem.status !== 'reported' || problem.adoptedByNgoId) {
      const err = new Error('This problem has already been adopted by an organization.');
      err.statusCode = 409;
      throw err;
    }

    // Prepare project data
    const projectPayload = {
      ngoId,
      sourceProblemId: problem._id,
      title: customData.title || problem.title,
      problemStatement: customData.problemStatement || problem.description,
      description: customData.description || problem.description,
      category: customData.category || problem.category,
      location: customData.location || problem.location,
      beneficiaries: customData.beneficiaries || { estimatedCount: 0, description: '' },
      requiredSkills: customData.requiredSkills || [],
      volunteersNeeded: customData.volunteersNeeded || 0,
      materialsNeeded: customData.materialsNeeded || [],
      fundingRequired: customData.fundingRequired || 0,
      fundingReceived: 0,
      fundingSpent: 0,
      timeline: customData.timeline || {},
      milestones: customData.milestones || [],
      status: 'adopted',
      photos: {
        before: problem.photos || [],
        progress: [],
        after: []
      },
      teamMembers: []
    };

    const [project] = await Project.create([projectPayload], opts);

    // Update Problem
    problem.status = 'adopted';
    problem.adoptedByNgoId = ngoId;
    problem.linkedProjectId = project._id;
    await problem.save(opts);

    return { project, problem };
  });
};

/**
 * Create a direct project (without a source problem).
 */
export const createDirectProject = async (ngoId, projectData) => {
  const payload = {
    ...projectData,
    ngoId,
    sourceProblemId: null,
    status: projectData.status || 'adopted',
    fundingReceived: 0,
    fundingSpent: 0,
    teamMembers: []
  };

  const project = await Project.create(payload);
  return project;
};

/**
 * List projects owned by this NGO.
 */
export const getNgoProjects = async (ngoId, query = {}) => {
  const filter = { ngoId };
  if (query.status) {
    filter.status = query.status;
  }
  if (query.category) {
    filter.category = query.category;
  }

  const projects = await Project.find(filter)
    .sort({ createdAt: -1 })
    .populate('sourceProblemId', 'title photos')
    .lean();

  return projects;
};

/**
 * Get single project detail, enforcing NGO ownership.
 */
export const getProjectById = async (ngoId, projectId) => {
  const project = await Project.findById(projectId)
    .populate('sourceProblemId')
    .populate('teamMembers', 'name email profilePhotoUrl location')
    .lean();

  if (!project) {
    const err = new Error('Project not found.');
    err.statusCode = 404;
    throw err;
  }

  if (project.ngoId.toString() !== ngoId.toString()) {
    const err = new Error('Access denied. You do not have permission to view this project.');
    err.statusCode = 403;
    throw err;
  }

  return project;
};

/**
 * Update project details.
 */
export const updateProject = async (ngoId, projectId, updateData) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found.');
    err.statusCode = 404;
    throw err;
  }

  if (project.ngoId.toString() !== ngoId.toString()) {
    const err = new Error('Access denied. You do not have permission to modify this project.');
    err.statusCode = 403;
    throw err;
  }

  const allowedFields = [
    'title',
    'problemStatement',
    'description',
    'category',
    'location',
    'beneficiaries',
    'requiredSkills',
    'volunteersNeeded',
    'materialsNeeded',
    'fundingRequired',
    'timeline',
    'milestones'
  ];

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      project[field] = updateData[field];
    }
  }

  await project.save();
  return project;
};

/**
 * Move project through sequential status pipeline.
 * Validates sequential order and prevents invalid jumps.
 */
export const updateProjectStatus = async (ngoId, projectId, newStatus) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found.');
    err.statusCode = 404;
    throw err;
  }

  if (project.ngoId.toString() !== ngoId.toString()) {
    const err = new Error('Access denied. You do not own this project.');
    err.statusCode = 403;
    throw err;
  }

  const currentIndex = STATUS_PIPELINE.indexOf(project.status);
  const targetIndex = STATUS_PIPELINE.indexOf(newStatus);

  if (targetIndex === -1) {
    const err = new Error(`'${newStatus}' is not a valid project status.`);
    err.statusCode = 400;
    throw err;
  }

  // Enforce sequential pipeline progression: can advance by 1 step or stay same
  // Cannot jump steps (e.g. adopted -> completed) and cannot jump backward
  if (targetIndex !== currentIndex && targetIndex !== currentIndex + 1) {
    const err = new Error(
      `Invalid status transition from '${project.status}' to '${newStatus}'. Status must follow pipeline: ${STATUS_PIPELINE.slice(1).join(' -> ')}`
    );
    err.statusCode = 400;
    throw err;
  }

  // If transitioning to completed, delegate to completion validation
  if (newStatus === 'completed') {
    return await completeProject(ngoId, projectId);
  }

  project.status = newStatus;
  await project.save();

  // Sync linked problem status if exists
  if (project.sourceProblemId) {
    await Problem.findByIdAndUpdate(project.sourceProblemId, { status: newStatus });
  }

  return project;
};

/**
 * Get volunteer applicants for a project (from linked Problem or Project).
 */
export const getProjectApplicants = async (ngoId, projectId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found.');
    err.statusCode = 404;
    throw err;
  }

  if (project.ngoId.toString() !== ngoId.toString()) {
    const err = new Error('Access denied. You do not own this project.');
    err.statusCode = 403;
    throw err;
  }

  // Find applications linked to project OR linked to sourceProblem
  const filter = {
    $or: [{ projectId: project._id }]
  };
  if (project.sourceProblemId) {
    filter.$or.push({ problemId: project.sourceProblemId });
  }

  const applications = await Application.find(filter)
    .populate('userId', 'name email profilePhotoUrl location phone')
    .sort({ createdAt: -1 })
    .lean();

  // Augment each applicant with their CommunityUserProfile
  const userIds = applications.map((a) => a.userId?._id).filter(Boolean);
  const profiles = await CommunityUserProfile.find({ userId: { $in: userIds } }).lean();
  const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

  const enrichedApplicants = applications.map((app) => ({
    ...app,
    userProfile: app.userId?._id ? profileMap.get(app.userId._id.toString()) || null : null
  }));

  return enrichedApplicants;
};

/**
 * Accept or reject a volunteer application.
 * On acceptance, adds applicant's user ID to project.teamMembers.
 */
export const reviewApplication = async (ngoId, applicationId, newStatus) => {
  if (!['accepted', 'rejected'].includes(newStatus)) {
    const err = new Error('Status must be either "accepted" or "rejected".');
    err.statusCode = 400;
    throw err;
  }

  const application = await Application.findById(applicationId);
  if (!application) {
    const err = new Error('Application not found.');
    err.statusCode = 404;
    throw err;
  }

  // Find the project this application belongs to
  let project = null;
  if (application.projectId) {
    project = await Project.findById(application.projectId);
  } else if (application.problemId) {
    project = await Project.findOne({ sourceProblemId: application.problemId });
  }

  if (!project) {
    const err = new Error('Associated project not found for this application.');
    err.statusCode = 404;
    throw err;
  }

  if (project.ngoId.toString() !== ngoId.toString()) {
    const err = new Error('Access denied. You do not own the project for this application.');
    err.statusCode = 403;
    throw err;
  }

  application.status = newStatus;
  await application.save();

  // If accepted, add to teamMembers if not already present
  if (newStatus === 'accepted') {
    const memberIdStr = application.userId.toString();
    const alreadyMember = (project.teamMembers || []).some((m) => m.toString() === memberIdStr);
    if (!alreadyMember) {
      project.teamMembers.push(application.userId);
      await project.save();
    }
  }

  return { application, project };
};

/**
 * Update project resource tracking: materials received & funding spent.
 */
export const updateProjectResources = async (ngoId, projectId, resourceData) => {
  const { materials, fundingSpent, receiptNote } = resourceData;

  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found.');
    err.statusCode = 404;
    throw err;
  }

  if (project.ngoId.toString() !== ngoId.toString()) {
    const err = new Error('Access denied. You do not own this project.');
    err.statusCode = 403;
    throw err;
  }

  if (fundingSpent !== undefined) {
    const parsedSpent = Number(fundingSpent);
    if (isNaN(parsedSpent) || parsedSpent < 0) {
      const err = new Error('Funding spent must be a non-negative number.');
      err.statusCode = 400;
      throw err;
    }
    project.fundingSpent = parsedSpent;
  }

  if (Array.isArray(materials)) {
    for (const update of materials) {
      const target = project.materialsNeeded.id(update._id);
      if (target && update.quantityReceived !== undefined) {
        target.quantityReceived = Math.max(0, Number(update.quantityReceived));
      }
    }
  }

  await project.save();
  return project;
};

/**
 * Upload photos for a project (before / progress / after).
 */
export const uploadProjectPhotos = async (ngoId, projectId, category, urls) => {
  if (!['before', 'progress', 'after'].includes(category)) {
    const err = new Error('Photo category must be "before", "progress", or "after".');
    err.statusCode = 400;
    throw err;
  }

  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found.');
    err.statusCode = 404;
    throw err;
  }

  if (project.ngoId.toString() !== ngoId.toString()) {
    const err = new Error('Access denied. You do not own this project.');
    err.statusCode = 403;
    throw err;
  }

  if (!project.photos) {
    project.photos = { before: [], progress: [], after: [] };
  }

  project.photos[category].push(...urls);
  await project.save();
  return project;
};

/**
 * Mark a project completed.
 * Gated: Requires at least 1 "after" photo and beneficiaries.estimatedCount > 0.
 * Automatically triggers recalculateNgoStats.
 */
export const completeProject = async (ngoId, projectId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found.');
    err.statusCode = 404;
    throw err;
  }

  if (project.ngoId.toString() !== ngoId.toString()) {
    const err = new Error('Access denied. You do not own this project.');
    err.statusCode = 403;
    throw err;
  }

  // Completion criteria checks
  const hasAfterPhoto = Array.isArray(project.photos?.after) && project.photos.after.length > 0;
  const hasBeneficiaries = Number(project.beneficiaries?.estimatedCount) > 0;

  if (!hasAfterPhoto) {
    const err = new Error('Cannot complete project: At least one "after" impact photo is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!hasBeneficiaries) {
    const err = new Error('Cannot complete project: Estimated beneficiaries count must be greater than 0.');
    err.statusCode = 400;
    throw err;
  }

  project.status = 'completed';
  await project.save();

  // Sync linked problem status
  if (project.sourceProblemId) {
    await Problem.findByIdAndUpdate(project.sourceProblemId, { status: 'completed' });
  }

  // Recalculate NGO impact stats
  await recalculateNgoStats(ngoId);

  return project;
};

/**
 * Recalculate aggregated impact metrics for an NGO across all completed projects.
 */
export const recalculateNgoStats = async (ngoId) => {
  const completedProjects = await Project.find({
    ngoId,
    status: 'completed'
  }).lean();

  const previousProjectsCount = completedProjects.length;
  const totalBeneficiariesReached = completedProjects.reduce(
    (sum, p) => sum + (Number(p.beneficiaries?.estimatedCount) || 0),
    0
  );

  // Volunteer hours estimated from teamMembers (avg 12 hours per volunteer per completed project)
  const totalVolunteerHours = completedProjects.reduce(
    (sum, p) => sum + ((p.teamMembers?.length || 0) * 12),
    0
  );

  const updatedProfile = await NGOProfile.findOneAndUpdate(
    { userId: ngoId },
    {
      previousProjectsCount,
      totalBeneficiariesReached,
      totalVolunteerHours
    },
    { new: true }
  );

  return updatedProfile;
};

/**
 * Dashboard summary metrics aggregation.
 */
export const getDashboardSummary = async (ngoId, userCity = '') => {
  const [
    activeProjectsCount,
    projectsNeedingFundingCount,
    completedProjectsCount,
    allNgoProjects,
    profile
  ] = await Promise.all([
    Project.countDocuments({
      ngoId,
      status: { $in: ['adopted', 'team_forming', 'funding_needed', 'in_progress'] }
    }),
    Project.countDocuments({
      ngoId,
      status: 'funding_needed'
    }),
    Project.countDocuments({
      ngoId,
      status: 'completed'
    }),
    Project.find({ ngoId }).select('_id sourceProblemId').lean(),
    NGOProfile.findOne({ userId: ngoId }).lean()
  ]);

  // Nearby unadopted problems count
  const cityFilter = userCity ? { 'location.city': { $regex: String(userCity).trim(), $options: 'i' } } : {};
  const newNearbyProblemsCount = await Problem.countDocuments({
    status: 'reported',
    adoptedByNgoId: null,
    ...cityFilter
  });

  // Pending applications for this NGO's projects or linked problems
  const projectIds = allNgoProjects.map((p) => p._id);
  const sourceProblemIds = allNgoProjects.map((p) => p.sourceProblemId).filter(Boolean);

  const pendingApplicationsCount = await Application.countDocuments({
    status: 'pending',
    $or: [
      { projectId: { $in: projectIds } },
      { problemId: { $in: sourceProblemIds } }
    ]
  });

  return {
    activeProjectsCount,
    newNearbyProblemsCount,
    pendingApplicationsCount,
    projectsNeedingFundingCount,
    completedProjectsCount,
    impactStats: {
      previousProjectsCount: profile?.previousProjectsCount || 0,
      totalBeneficiariesReached: profile?.totalBeneficiariesReached || 0,
      totalVolunteerHours: profile?.totalVolunteerHours || 0,
      verificationStatus: profile?.verificationStatus || 'pending'
    }
  };
};
