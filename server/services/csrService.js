import { progressSummary } from './impactCalculations.js';
import { csrRecommendations } from './recommendationService.js';
import Project from '../models/Project.js';
import NGOProfile from '../models/NGOProfile.js';
import CSRProfile from '../models/CSRProfile.js';
import User from '../models/User.js';
import Funding from '../models/Funding.js';
import { PROBLEM_CATEGORIES } from '../models/Problem.js';
import { literal } from './problemDiscovery.js';
import { fail, validId, portfolioSummary, paise } from './fundingService.js';
const focusMap = {
  'Education & Literacy': ['education'],
  'Healthcare & Sanitation': ['health', 'cleaning'],
  'Environment & Climate': ['environment'],
  'Hunger & Food Security': ['other'],
  'Women Empowerment': ['education', 'health'],
  'Animal Welfare': ['animal_welfare'],
  'Disaster Relief': ['repair', 'health'],
  'Elderly Care': ['elderly_support'],
  'Youth Development': ['education'],
  'Community Arts & Culture': ['other']
};
export function focusCategories(areas = []) {
  if (!Array.isArray(areas) || areas.length > 30 || areas.some(a => typeof a !== 'string')) fail('Focus areas must be a list.');
  return [...new Set(areas.flatMap(area => {
    const value = area.trim();
    if (PROBLEM_CATEGORIES.includes(value.toLowerCase())) return [value.toLowerCase()];
    const key = Object.keys(focusMap).find(k => k.toLowerCase() === value.toLowerCase());
    if (!key) fail(`Unknown focus area: ${value}. Choose a project category.`);
    return focusMap[key];
  }))];
}
const numeric = (value, label) => {
  if (value === undefined || value === '') return undefined;
  if (!['string', 'number'].includes(typeof value) || !Number.isFinite(Number(value)) || Number(value) < 0) fail(`Invalid ${label}.`);
  return Number(value);
};
export const getProfile = async userId => {
  const profile = await CSRProfile.findOne({
    userId
  });
  if (!profile) fail('CSR profile not found.', 404);
  const user = await User.findById(userId).select('name email role');
  return {
    profile,
    user
  };
};
export const updateProfile = async (userId, data) => {
  const {
    profile
  } = await getProfile(userId);
  for (const key of ['companyName', 'industry', 'budgetRange', 'companyWebsite', 'csrManagerName']) if (data[key] !== undefined) {
    if (typeof data[key] !== 'string' || data[key].length > 500) fail(`Invalid ${key}.`);
    profile[key] = data[key].trim();
  }
  if (profile.companyWebsite && !/^https?:\/\/[^\s]+$/i.test(profile.companyWebsite)) fail('Website must begin with https:// or http://.');
  if (data.csrFocusAreas !== undefined) {
    focusCategories(data.csrFocusAreas);
    profile.csrFocusAreas = [...new Set(data.csrFocusAreas.map(a => a.trim()))];
  }
  await profile.save();
  return getProfile(userId);
};
export const budgetFilters = range => {
  const match = /^INR\s+(\d+)\s*-\s*(\d+)$/i.exec(range || '');
  return match ? {
    budgetMin: Number(match[1]),
    budgetMax: Number(match[2])
  } : {};
};
export async function discoverProjects(query = {}, allCandidates = false) {
  const filter = {
    ngoId: {
      $ne: null
    }
  };
  if (query.category && !PROBLEM_CATEGORIES.includes(query.category)) fail('Invalid category.');
  const categories = query.category ? [query.category] : query.cause ? focusCategories([query.cause]) : [];
  if (categories.length) filter.category = {
    $in: categories
  };
  if (query.location) {
    if (typeof query.location !== 'string') fail('Invalid location.');
    filter.$or = ['location.city', 'location.area'].map(k => ({
      [k]: {
        $regex: literal(query.location),
        $options: 'i'
      }
    }));
  }
  const min = numeric(query.budgetMin ?? query.fundingMin, 'minimum funding'),
    max = numeric(query.budgetMax ?? query.fundingMax, 'maximum funding');
  if (min !== undefined && max !== undefined && min > max) fail('Minimum funding cannot exceed maximum.');
  if (min !== undefined || max !== undefined) filter.fundingRequired = {
    ...(min !== undefined ? {
      $gte: min
    } : {}),
    ...(max !== undefined ? {
      $lte: max
    } : {})
  };
  const bmin = numeric(query.beneficiariesMin, 'minimum beneficiaries'),
    bmax = numeric(query.beneficiariesMax, 'maximum beneficiaries');
  if (bmin !== undefined && bmax !== undefined && bmin > bmax) fail('Invalid beneficiary range.');
  if (bmin !== undefined || bmax !== undefined) filter['beneficiaries.estimatedCount'] = {
    ...(bmin !== undefined ? {
      $gte: bmin
    } : {}),
    ...(bmax !== undefined ? {
      $lte: bmax
    } : {})
  };
  if (query.includeFullyFunded !== undefined && !['true', 'false', true, false, ''].includes(query.includeFullyFunded)) fail('Invalid fully-funded toggle.');
  if (![true, 'true'].includes(query.includeFullyFunded)) {
    filter.$expr = {
      $gt: ['$fundingRequired', '$fundingReceived']
    };
    filter.status = {
      $ne: 'completed'
    };
  }
  const afterJoin = {};
  if (query.verificationStatus) {
    if (!['pending', 'verified', 'rejected'].includes(query.verificationStatus)) fail('Invalid verification status.');
    afterJoin['ngo.verificationStatus'] = query.verificationStatus;
  }
  if (query.urgency) {
    if (!['low', 'medium', 'high'].includes(query.urgency)) fail('Invalid urgency.');
    afterJoin.urgency = query.urgency;
  }
  const months = numeric(query.timelineMonths, 'timeline duration');
  if (months !== undefined) afterJoin.durationMonths = {
    $ne: null,
    $gte: 0,
    $lte: months
  };
  const page = Math.min(100000, Math.max(1, Math.floor(numeric(query.page, 'page') || 1))),
    limit = Math.min(50, Math.max(1, Math.floor(numeric(query.limit, 'limit') || 12)));
  // Discovery stays filter-based; recommendationService scores the full candidate set separately.
  const [result] = await Project.aggregate([{
    $match: filter
  }, {
    $lookup: {
      from: 'ngoprofiles',
      localField: 'ngoId',
      foreignField: 'userId',
      as: 'ngo'
    }
  }, {
    $unwind: '$ngo'
  }, {
    $lookup: {
      from: 'problems',
      localField: 'sourceProblemId',
      foreignField: '_id',
      as: 'source'
    }
  }, {
    $addFields: {
      urgency: {
        $ifNull: [{
          $arrayElemAt: ['$source.urgency', 0]
        }, null]
      },
      durationMonths: {
        $cond: [{
          $and: ['$timeline.startDate', '$timeline.expectedEndDate']
        }, {
          $divide: [{
            $subtract: ['$timeline.expectedEndDate', '$timeline.startDate']
          }, 1000 * 60 * 60 * 24 * 30.4375]
        }, null]
      },
      overlapCount: {
        $cond: [{
          $in: ['$category', categories]
        }, 1, 0]
      },
      fundingGap: {
        $max: [0, {
          $subtract: ['$fundingRequired', '$fundingReceived']
        }]
      }
    }
  }, {
    $match: afterJoin
  }, {
    $sort: {
      createdAt: -1,
      _id: 1
    }
  }, {
    $project: {
      createdAt: 1,
      title: 1,
      problemStatement: 1,
      description: 1,
      category: 1,
      'location.city': 1,
      'location.area': 1,
      beneficiaries: 1,
      timeline: 1,
      photos: 1,
      status: 1,
      fundingRequired: 1,
      fundingReceived: 1,
      fundingSpent: 1,
      fundingGap: 1,
      urgency: 1,
      durationMonths: 1,
      overlapCount: 1,
      ngo: {
        userId: '$ngo.userId',
        ngoName: '$ngo.ngoName',
        verificationStatus: '$ngo.verificationStatus',
        previousProjectsCount: '$ngo.previousProjectsCount',
        totalBeneficiariesReached: '$ngo.totalBeneficiariesReached'
      }
    }
  }, {
    $facet: {
      count: [{
        $count: 'total'
      }],
      items: allCandidates ? [{ $match: {} }] : [{
        $skip: (page - 1) * limit
      }, {
        $limit: limit
      }]
    }
  }]);
  const total = result?.count[0]?.total || 0;
  return {
    items: result?.items || [],
    total,
    page,
    totalPages: Math.ceil(total / limit),
    matching: false
  };
}
export async function projectDetail(projectId) {
  const p = await Project.findById(validId(projectId)).select('-location.coordinates -teamMembers -fundedBy -__v').lean();
  if (!p) fail('Project not found.', 404);
  const ngo = await NGOProfile.findOne({
    userId: p.ngoId
  }).select('userId ngoName about causeAreas locationsServed verificationStatus previousProjectsCount totalBeneficiariesReached totalVolunteerHours photos').lean();
  if (!ngo) fail('Managing NGO not found.', 404);
  const count = await Project.findById(p._id).select('teamMembers').lean();
  const active = await Funding.find({
    projectId,
    status: {
      $ne: 'withdrawn'
    }
  }).select('amountSpentSoFar').lean();
  return {
    ...p,
    ngo,
    volunteerParticipation: count.teamMembers?.length || 0,
    unattributedSpent: Math.max(0, paise(p.fundingSpent) - active.reduce((sum, f) => sum + paise(f.amountSpentSoFar), 0) - paise(p.volunteerFundingSpent || 0)) / 100
  };
}
export async function getFundings(userId, query = {}) {
  if (query.status && !['allocated', 'in_progress', 'completed', 'withdrawn'].includes(query.status)) fail('Invalid funding status.');
  return Funding.find({
    csrUserId: userId,
    ...(query.status ? {
      status: query.status
    } : {})
  }).select('-idempotencyKey').populate('projectId', 'title status ngoId fundingRequired fundingReceived fundingSpent timeline photos beneficiaries').sort({
    allocationDate: -1
  }).lean();
}
export async function getFunding(userId, fundingId) {
  const record = await Funding.findById(validId(fundingId)).select('-idempotencyKey').populate('projectId', 'title status fundingRequired fundingReceived fundingSpent').lean();
  if (!record) fail('Funding not found.', 404);
  if (String(record.csrUserId) !== String(userId)) fail('You do not own this allocation.', 403);
  return record;
}
async function ownProject(userId, projectId) {
  validId(projectId);
  if (!(await Funding.exists({
    csrUserId: userId,
    projectId,
    status: {
      $ne: 'withdrawn'
    }
  }))) fail('This project is not in your current funded portfolio.', 403);
  return projectDetail(projectId);
}
const warnings = p => {
  const now = Date.now();
  return [...(p.status !== 'completed' && p.timeline?.expectedEndDate && +new Date(p.timeline.expectedEndDate) < now ? ['The expected project end date has passed.'] : []), ...(p.milestones || []).filter(m => !m.completed && m.targetDate && +new Date(m.targetDate) < now).map(m => `Overdue milestone: ${m.title}`)];
};
export async function progress(userId, projectId) {
  const project = await ownProject(userId, projectId);
  const allocations = await Funding.find({
    csrUserId: userId,
    projectId,
    status: {
      $ne: 'withdrawn'
    }
  }).select('amountAllocated amountSpentSoFar status allocationDate notes').lean();
  const allocated = allocations.reduce((n, f) => n + paise(f.amountAllocated), 0) / 100,
    spent = allocations.reduce((n, f) => n + paise(f.amountSpentSoFar), 0) / 100;
  return {
    project,
    funding: {
      allocated,
      spent,
      remaining: paise(allocated - spent) / 100
    },
    allocations,
    scheduleWarnings: warnings(project),
    issueLogNote: 'No separate issue notes have been recorded. Schedule warnings are based on project and milestone dates.',
    simulated: true,
    currency: 'INR'
  };
}
export async function report(userId, projectId) {
  const data = await progress(userId, projectId);
  // Structured report now; downloadable PDF/export is Prompt 8 polish.
  return {
    ...data,
    progressSummary: await progressSummary(projectId),
    generatedAt: new Date(),
    beneficiariesReached: data.project.status === 'completed' ? data.project.beneficiaries.estimatedCount : 0,
    estimatedBeneficiaries: data.project.beneficiaries.estimatedCount,
    completedMilestones: data.project.milestones.filter(m => m.completed),
    volunteerParticipation: data.project.volunteerParticipation,
    outcomesSummary: data.project.status === 'completed' ? `Completed with ${data.project.beneficiaries.estimatedCount} recorded beneficiaries and ${data.project.milestones.filter(m => m.completed).length} completed milestones.` : 'Work is ongoing; beneficiary figures are estimates until the NGO completes the project.'
  };
}
export async function dashboard(userId) {
  const [summary, {
    profile
  }, fundings] = await Promise.all([portfolioSummary(userId), getProfile(userId), getFundings(userId)]);
  const recommended = await csrRecommendations(userId, { limit: 6 });
  const projectIds = [...new Set(fundings.filter(f => f.status !== 'withdrawn' && f.projectId).map(f => String(f.projectId._id)))];
  const activity = await Project.find({
    _id: {
      $in: projectIds
    }
  }).select('title status milestones photos updatedAt resourceUpdates').sort({
    updatedAt: -1
  }).limit(5).lean();
  return {
    ...summary,
    budgetRange: profile.budgetRange,
    recommendationNote: recommended.recommendationNote,
    recommendedProjects: recommended.items,
    activeFundings: fundings.filter(f => ['allocated', 'in_progress'].includes(f.status)).slice(0, 6),
    recentActivity: activity.map(p => ({
      projectId: p._id,
      title: p.title,
      updatedAt: p.updatedAt,
      completedMilestones: p.milestones.filter(m => m.completed).map(m => m.title),
      photoCount: ['before', 'progress', 'after'].reduce((n, stage) => n + (p.photos?.[stage]?.length || 0), 0),
      latestResourceUpdate: p.resourceUpdates?.at(-1) || null
    }))
  };
}
