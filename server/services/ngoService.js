import mongoose from 'mongoose';
import User from '../models/User.js';
import NGOProfile from '../models/NGOProfile.js';
import Problem, { PROBLEM_STATUSES } from '../models/Problem.js';
import Project from '../models/Project.js';
import Application from '../models/Application.js';
import CommunityUserProfile from '../models/CommunityUserProfile.js';
import { strictTransaction } from '../utils/strictTransaction.js';
import { discoverProblems, literal } from './problemDiscovery.js';
const fail = (message, statusCode = 400) => {
  throw Object.assign(new Error(message), {
    statusCode
  });
};
const id = value => {
  if (!mongoose.isValidObjectId(value)) fail('Invalid record ID.');
  return value;
};
const number = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) fail(`${label} must be a finite non-negative number.`);
  return value;
};
const photoUrl = value => typeof value === 'string' && (/^https?:\/\/[^\s]+$/i.test(value) || /^\/uploads\/[\w.-]+$/.test(value));
const strings = (value, label) => {
  if (!Array.isArray(value) || value.length > 50 || value.some(v => typeof v !== 'string' || !v.trim() || v.length > 500)) fail(`Invalid ${label}.`);
  return [...new Set(value.map(v => v.trim()))];
};
const fields = ['title', 'problemStatement', 'description', 'category', 'location', 'beneficiaries', 'requiredSkills', 'volunteersNeeded', 'materialsNeeded', 'fundingRequired', 'timeline', 'milestones', 'volunteerHours'];
const owned = async (ngoId, projectId, session = null) => {
  const project = await Project.findById(id(projectId)).session(session);
  if (!project) fail('Project not found.', 404);
  if (String(project.ngoId) !== String(ngoId)) fail('You do not own this project.', 403);
  return project;
};
const verified = async (ngoId, session = null) => {
  const profile = await NGOProfile.findOne({
    userId: ngoId
  }).session(session);
  if (profile?.verificationStatus !== 'verified') fail('An administrator must verify your NGO before you can adopt or create projects.', 403);
};
const applyFields = (project, data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('Invalid project data.');
  for (const key of fields) {
    if (data[key] === undefined) continue;
    if (['fundingRequired', 'volunteersNeeded', 'volunteerHours'].includes(key)) number(data[key], key);
    if (key === 'volunteersNeeded' && !Number.isInteger(data[key])) fail('Volunteers needed must be a whole number.');
    if (key === 'requiredSkills') strings(data[key], key);
    if (key === 'beneficiaries') {
      number(data[key]?.estimatedCount, 'Beneficiaries');
      if (!Number.isInteger(data[key].estimatedCount)) fail('Beneficiaries must be a whole number.');
    }
    if (key === 'location' && data[key]?.coordinates !== undefined) {
      const c = data[key].coordinates;
      if (!Array.isArray(c) || c.length !== 2 || c.some(v => typeof v !== 'number' || !Number.isFinite(v)) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90) fail('Invalid coordinates.');
    }
    if (key === 'materialsNeeded') {
      if (!Array.isArray(data[key]) || data[key].length > 100) fail('Invalid materials.');
      const previous = new Map((project.materialsNeeded || []).map(m => [String(m._id), m]));
      for (const m of data[key]) {
        number(m.quantityNeeded, 'Material quantity');
        const old = previous.get(String(m._id));
        if (m.quantityReceived !== undefined && m.quantityReceived !== (old?.quantityReceived || 0)) fail('Update received materials through resource tracking with a note.');
      }
      for (const old of previous.values()) if (old.quantityReceived > 0 && !data[key].some(m => String(m._id) === String(old._id))) fail('Cannot remove a material with received quantities.');
      project[key] = data[key].map(m => ({
        ...m,
        quantityReceived: previous.get(String(m._id))?.quantityReceived || 0
      }));
      continue;
    }
    if (key === 'milestones' && (!Array.isArray(data[key]) || data[key].length > 100)) fail('Invalid milestones.');
    project[key] = data[key];
  }
  if (project.timeline?.startDate && project.timeline?.expectedEndDate && project.timeline.startDate > project.timeline.expectedEndDate) fail('End date must not precede start date.');
};
export const getNgoProfile = async userId => {
  const [user, profile] = await Promise.all([User.findById(userId), NGOProfile.findOne({
    userId
  })]);
  if (!profile) fail('NGO profile not found.', 404);
  return {
    user,
    profile
  };
};
export const updateNgoProfile = async (userId, data) => {
  const {
    profile
  } = await getNgoProfile(userId);
  for (const key of ['ngoName', 'about', 'contactPersonName', 'contactPhone']) if (data[key] !== undefined) {
    if (typeof data[key] !== 'string') fail(`Invalid ${key}.`);
    profile[key] = data[key].trim();
  }
  for (const key of ['causeAreas', 'locationsServed', 'photos']) if (data[key] !== undefined) profile[key] = strings(data[key], key);
  if (profile.photos.some(p => !photoUrl(p))) fail('Invalid photo URL.');
  if (data.team !== undefined) {
    if (!Array.isArray(data.team) || data.team.length > 50) fail('Invalid team.');
    profile.team = data.team.map(m => {
      if (!m || typeof m.name !== 'string' || typeof m.role !== 'string' || m.photoUrl && !photoUrl(m.photoUrl)) fail('Invalid team member.');
      return {
        name: m.name,
        role: m.role,
        photoUrl: m.photoUrl || ''
      };
    });
  }
  await profile.save();
  return getNgoProfile(userId);
};
export const getUnadoptedProblems = query => discoverProblems(query, true);
export const adoptProblem = (ngoId, problemId, data = {}) => strictTransaction(async session => {
  await verified(ngoId, session);
  const problem = await Problem.findOneAndUpdate({
    _id: id(problemId),
    status: 'reported',
    adoptedByNgoId: null,
    linkedProjectId: null
  }, {
    $set: {
      adoptedByNgoId: ngoId,
      status: 'adopted'
    }
  }, {
    new: true,
    session
  });
  if (!problem) {
    if (!(await Problem.exists({
      _id: problemId
    }).session(session))) fail('Problem not found.', 404);
    fail('This problem has already been adopted.', 409);
  }
  const project = new Project({
    ngoId,
    sourceProblemId: problem._id,
    title: problem.title,
    problemStatement: problem.description,
    description: problem.description,
    category: problem.category,
    location: problem.location,
    photos: {
      before: problem.photos
    },
    status: 'adopted'
  });
  applyFields(project, data);
  await project.save({
    session
  });
  problem.linkedProjectId = project._id;
  await problem.save({
    session
  });
  return {
    project,
    problem
  };
});
export const createDirectProject = async (ngoId, data) => {
  await verified(ngoId);
  if (data.status && data.status !== 'adopted') fail('New projects begin at adopted.');
  const project = new Project({
    ngoId,
    sourceProblemId: null,
    status: 'adopted'
  });
  applyFields(project, data);
  await project.save();
  return project;
};
const applicationFilter = project => ({
  $or: [{
    projectId: project._id
  }, ...(project.sourceProblemId ? [{
    problemId: project.sourceProblemId._id || project.sourceProblemId
  }] : [])]
});
export const getNgoProjects = async (ngoId, query = {}) => {
  if (query.status && !PROBLEM_STATUSES.includes(query.status)) fail('Invalid status.');
  const projects = await Project.find({
    ngoId,
    ...(query.status ? {
      status: query.status
    } : {})
  }).sort({
    createdAt: -1
  }).lean();
  const apps = await Application.find({
    $or: [{
      projectId: {
        $in: projects.map(p => p._id)
      }
    }, {
      problemId: {
        $in: projects.map(p => p.sourceProblemId).filter(Boolean)
      }
    }]
  }).select('projectId problemId').lean();
  return projects.map(p => ({
    ...p,
    applicantsCount: apps.filter(a => String(a.projectId) === String(p._id) || p.sourceProblemId && String(a.problemId) === String(p.sourceProblemId)).length
  }));
};
export const getProjectById = async (ngoId, projectId) => {
  const project = await owned(ngoId, projectId);
  await project.populate([{
    path: 'sourceProblemId',
    select: '-location.coordinates'
  }, {
    path: 'teamMembers',
    select: 'name email profilePhotoUrl location.city'
  }]);
  return project;
};
export const recalculateNgoStats = async (ngoId, session = null) => {
  const [stats] = await Project.aggregate([{
    $match: {
      ngoId: new mongoose.Types.ObjectId(String(ngoId)),
      status: 'completed'
    }
  }, {
    $group: {
      _id: null,
      previousProjectsCount: {
        $sum: 1
      },
      totalBeneficiariesReached: {
        $sum: '$beneficiaries.estimatedCount'
      },
      totalVolunteerHours: {
        $sum: '$volunteerHours'
      }
    }
  }]).session(session);
  const totals = stats || {
    previousProjectsCount: 0,
    totalBeneficiariesReached: 0,
    totalVolunteerHours: 0
  };
  delete totals._id;
  await NGOProfile.updateOne({
    userId: ngoId
  }, {
    $set: totals
  }, {
    session
  });
  return totals;
};
const transition = (project, status) => {
  const current = PROBLEM_STATUSES.indexOf(project.status),
    next = PROBLEM_STATUSES.indexOf(status);
  if (next < 0 || next !== current && next !== current + 1) fail('Status must advance one step in the project pipeline.');
  if (status === 'completed' && (!project.photos?.after?.length || !(project.beneficiaries?.estimatedCount > 0))) fail('Completion requires an after photo and a positive beneficiary count.');
  project.status = status;
};
export const updateProject = (ngoId, projectId, data) => strictTransaction(async session => {
  const project = await owned(ngoId, projectId, session);
  applyFields(project, data);
  if (data.status !== undefined) transition(project, data.status);
  if (project.status === 'completed') transition(project, 'completed');
  await project.save({
    session
  });
  if (project.sourceProblemId) await Problem.updateOne({
    _id: project.sourceProblemId,
    linkedProjectId: project._id
  }, {
    $set: {
      status: project.status
    }
  }, {
    session
  });
  // Serialize recalculation for simultaneous completions through this profile write.
  if (project.status === 'completed') {
    await NGOProfile.updateOne({
      userId: ngoId
    }, {
      $inc: {
        __v: 1
      }
    }, {
      session
    });
    await recalculateNgoStats(ngoId, session);
  }
  return project;
});
export const updateProjectStatus = (ngoId, projectId, status) => updateProject(ngoId, projectId, {
  status
});
export const completeProject = (ngoId, projectId) => updateProjectStatus(ngoId, projectId, 'completed');
const enrich = async apps => {
  const profiles = await CommunityUserProfile.find({
    userId: {
      $in: apps.map(a => a.userId?._id).filter(Boolean)
    }
  }).select('userId skills subType availability').lean();
  return apps.map(a => ({
    ...a,
    userProfile: profiles.find(p => String(p.userId) === String(a.userId?._id)) || null
  }));
};
export const getProjectApplicants = async (ngoId, projectId) => {
  const project = await owned(ngoId, projectId);
  return enrich(await Application.find(applicationFilter(project)).populate('userId', 'name email profilePhotoUrl location.city').sort({
    createdAt: -1
  }).lean());
};
export const reviewApplication = (ngoId, applicationId, status, expectedProjectId) => strictTransaction(async session => {
  if (!['accepted', 'rejected'].includes(status)) fail('Choose accepted or rejected.');
  const application = await Application.findById(id(applicationId)).session(session);
  if (!application) fail('Application not found.', 404);
  const project = application.projectId ? await owned(ngoId, application.projectId, session) : await Project.findOne({
    sourceProblemId: application.problemId
  }).session(session);
  if (!project) fail('Associated project not found.', 404);
  if (String(project.ngoId) !== String(ngoId) || expectedProjectId && String(project._id) !== expectedProjectId) fail('You do not own this application.', 403);
  if (application.status !== 'pending' && application.status !== status) fail('This application has already been reviewed.', 409);
  if (project.status === 'completed' && application.status !== status) fail('This project is completed.', 409);
  application.status = status;
  await application.save({
    session
  });
  if (status === 'accepted') await Project.updateOne({
    _id: project._id
  }, {
    $addToSet: {
      teamMembers: application.userId
    }
  }, {
    session
  });
  return {
    application,
    project: await Project.findById(project._id).session(session)
  };
});
export const updateProjectResources = (ngoId, projectId, data) => strictTransaction(async session => {
  const project = await owned(ngoId, projectId, session);
  if (typeof data.receiptNote !== 'string' || !data.receiptNote.trim() || data.receiptNote.length > 2000) fail('A note or receipt reference is required.');
  if (data.fundingSpent !== undefined) project.fundingSpent = number(data.fundingSpent, 'Funding spent');
  if (data.materials !== undefined && !Array.isArray(data.materials)) fail('Invalid materials.');
  for (const m of data.materials || []) {
    const material = project.materialsNeeded.id(id(m._id));
    if (!material) fail('Unknown material.');
    material.quantityReceived = number(m.quantityReceived, 'Received quantity');
  }
  project.resourceUpdates.push({
    note: data.receiptNote.trim(),
    fundingSpent: project.fundingSpent,
    materials: project.materialsNeeded.map(m => ({
      materialId: String(m._id),
      quantityReceived: m.quantityReceived
    }))
  });
  await project.save({
    session
  });
  return project;
});
export const uploadProjectPhotos = async (ngoId, projectId, category, urls) => {
  await owned(ngoId, projectId);
  if (!['before', 'progress', 'after'].includes(category) || !Array.isArray(urls) || !urls.length || urls.some(p => !photoUrl(p))) fail('Choose a gallery and valid image URLs.');
  return Project.findOneAndUpdate({
    _id: projectId,
    ngoId
  }, {
    $push: {
      [`photos.${category}`]: {
        $each: urls
      }
    }
  }, {
    new: true,
    runValidators: true
  });
};
export const getDashboardSummary = async (ngoId, userCity = '') => {
  const profile = await NGOProfile.findOne({
    userId: ngoId
  }).lean();
  const locations = userCity ? [userCity] : profile?.locationsServed || [];
  const nearbyFilter = {
    status: 'reported',
    adoptedByNgoId: null,
    linkedProjectId: null,
    ...(locations.length ? {
      'location.city': {
        $in: locations.map(city => new RegExp(`^${literal(city)}$`, 'i'))
      }
    } : {})
  };
  const [counts] = await Project.aggregate([{
    $match: {
      ngoId: new mongoose.Types.ObjectId(String(ngoId))
    }
  }, {
    $lookup: {
      from: 'applications',
      let: {
        project: '$_id',
        problem: '$sourceProblemId'
      },
      pipeline: [{
        $match: {
          status: 'pending',
          $expr: {
            $or: [{
              $eq: ['$projectId', '$$project']
            }, {
              $and: [{
                $ne: ['$$problem', null]
              }, {
                $eq: ['$problemId', '$$problem']
              }]
            }]
          }
        }
      }],
      as: 'pending'
    }
  }, {
    $group: {
      _id: null,
      activeProjectsCount: {
        $sum: {
          $cond: [{
            $ne: ['$status', 'completed']
          }, 1, 0]
        }
      },
      completedProjectsCount: {
        $sum: {
          $cond: [{
            $eq: ['$status', 'completed']
          }, 1, 0]
        }
      },
      projectsNeedingFundingCount: {
        $sum: {
          $cond: [{
            $and: [{
              $ne: ['$status', 'completed']
            }, {
              $gt: ['$fundingRequired', '$fundingReceived']
            }]
          }, 1, 0]
        }
      },
      pendingApplicationsCount: {
        $sum: {
          $size: '$pending'
        }
      }
    }
  }]);
  const [nearbyProblems, newNearbyProblemsCount, projects] = await Promise.all([Problem.find(nearbyFilter).select('-location.coordinates').sort({
    createdAt: -1
  }).limit(6).lean(), Problem.countDocuments(nearbyFilter), getNgoProjects(ngoId)]);
  const pending = await Application.find({
    status: 'pending',
    $or: [{
      projectId: {
        $in: projects.map(p => p._id)
      }
    }, {
      problemId: {
        $in: projects.map(p => p.sourceProblemId).filter(Boolean)
      }
    }]
  }).populate('userId', 'name email profilePhotoUrl location.city').sort({
    createdAt: -1
  }).limit(8).lean();
  return {
    activeProjectsCount: 0,
    completedProjectsCount: 0,
    projectsNeedingFundingCount: 0,
    pendingApplicationsCount: 0,
    ...counts,
    newNearbyProblemsCount,
    nearbyProblems,
    nearbyScope: locations.length ? locations.join(', ') : 'All locations (add locations in your profile)',
    activeProjects: projects.filter(p => p.status !== 'completed').slice(0, 6),
    pendingApplications: await enrich(pending),
    impactStats: {
      previousProjectsCount: profile?.previousProjectsCount || 0,
      totalBeneficiariesReached: profile?.totalBeneficiariesReached || 0,
      totalVolunteerHours: profile?.totalVolunteerHours || 0,
      verificationStatus: profile?.verificationStatus || 'pending'
    }
  };
};
