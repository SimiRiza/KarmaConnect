import Project from '../models/Project.js';
import Contribution from '../models/Contribution.js';
import ImpactRecord from '../models/ImpactRecord.js';
import Team from '../models/Team.js';
import NGOProfile from '../models/NGOProfile.js';
import CSRProfile from '../models/CSRProfile.js';
import { strictTransaction } from '../utils/strictTransaction.js';
import { recalculateProjectFunding } from './fundingService.js';
import { recalculateNgoStats } from './ngoStats.js';
import { aggregateProjectFunding, aggregateProjectContributions, confirmedFilter, sumContributions } from './contributionAggregates.js';
import { fail, validId, paise } from './resourceValidation.js';
export { aggregateProjectFunding, aggregateProjectContributions } from './contributionAggregates.js';
export const milestoneProgress = milestones => milestones?.length ? Math.round(milestones.filter(m => m.completed).length / milestones.length * 10000) / 100 : 0;
export async function calculateProjectProgress(projectId, session = null) {
  if (!session) return strictTransaction(async s => { await lockProject(projectId, s); return calculateProjectProgress(projectId, s); });
  const project = await Project.findById(validId(projectId)).session(session);
  if (!project) fail('Project not found.', 404);
  project.progressPercentage = milestoneProgress(project.milestones); await project.save({ session });
  return project.progressPercentage;
}
export async function lockProject(projectId, session) {
  const p = await Project.findOneAndUpdate({ _id: validId(projectId) }, { $inc: { __v: 1 } }, { new: true, session });
  if (!p) fail('Project not found.', 404); return p;
}
export async function refreshContributionStats(projectId, session, notify = false) {
  const totals = await aggregateProjectContributions(projectId, session);
  const tracking = await Contribution.exists({ projectId, schemaVersion: 2, legacyNeedsReview: false, type: { $in: ['time', 'skills'] }, status: 'confirmed' }).session(session);
  const project = await Project.findById(projectId).session(session);
  project.contributionHours = totals.totalHours;
  if (tracking) project.contributionTracking = true;
  await project.save({ session });
  await recalculateProjectFunding(projectId, session, notify);
  if (project.status === 'completed') {
    await NGOProfile.updateOne({ userId: project.ngoId }, { $inc: { __v: 1 } }, { session });
    await recalculateNgoStats(project.ngoId, session);
  }
}
export async function generateImpactRecord(projectId, session = null, reconstructed = false, notify = false) {
  if (!session) return strictTransaction(async s => { await lockProject(projectId, s); return generateImpactRecord(projectId, s, reconstructed, notify); });
  let project = await Project.findById(validId(projectId)).session(session);
  if (!project || project.status !== 'completed') fail('A completed project is required.', 409);
  await refreshContributionStats(projectId, session, notify);
  const existing = await ImpactRecord.findOne({ projectId }).session(session);
  if (existing) return existing;
  project = await Project.findById(projectId).session(session);
  const totals = await aggregateProjectContributions(projectId, session), funding = await aggregateProjectFunding(projectId, session);
  const team = await Team.findOne({ projectId }).select('members').session(session);
  const ngo = await NGOProfile.findOne({ userId: project.ngoId }).select('ngoName').session(session);
  const companies = await CSRProfile.find({ userId: { $in: project.fundedBy } }).select('userId companyName').session(session);
  const [record] = await ImpactRecord.create([{
    projectId, title: project.title, description: project.problemStatement || project.description, category: project.category,
    location: { city: project.location.city, area: project.location.area },
    beneficiariesReached: project.beneficiaries.estimatedCount, totalVolunteerHours: totals.totalHours,
    totalMoneyRaised: funding.total, fundingRequired: project.fundingRequired, totalMoneySpent: project.fundingSpent, fundingBreakdown: funding,
    totalMaterialsContributed: totals.materials, volunteersInvolvedCount: team?.members.length || 0,
    ngoInvolved: project.ngoId, csrFundersInvolved: project.fundedBy, ngoName: ngo?.ngoName || 'Managing NGO',
    csrCredits: companies.map(c => ({ userId: c.userId, companyName: c.companyName })),
    beforePhotos: [...project.photos.before], progressPhotos: [...project.photos.progress], afterPhotos: [...project.photos.after],
    completedMilestones: project.milestones.filter(m => m.completed).map(m => m.title),
    outcomesSummary: project.outcomesSummary || '', completedAt: project.completedAt || null, reconstructed
  }], { session });
  return record;
}
export async function progressSummary(projectId) {
  validId(projectId);
  // Snapshot read guarantees one coherent response even while allocations/confirmations change.
  return strictTransaction(async session => {
    const p = await Project.findById(projectId).session(session).lean();
    if (!p) fail('Project not found.', 404);
    const funding = await aggregateProjectFunding(projectId, session), contributions = await aggregateProjectContributions(projectId, session);
    const spent = p.fundingSpent || 0;
    return { projectId: p._id, status: p.status, progressPercentage: milestoneProgress(p.milestones), milestones: p.milestones,
      funding: { ...funding, required: p.fundingRequired, collected: funding.total, spent, remaining: Math.max(0, paise(funding.total - spent)) / 100,
        gap: Math.max(0, paise(p.fundingRequired - funding.total)) / 100, excess: Math.max(0, paise(funding.total - p.fundingRequired)) / 100,
        fromVolunteerPoolSpent: p.volunteerFundingSpent || 0, unattributedSpent: p.unattributedSpent || 0 },
      contributions, legacyManualHours: p.volunteerHours || 0, contributionTracking: p.contributionTracking || false,
      hasImpactRecord: Boolean(await ImpactRecord.exists({ projectId }).session(session)), simulated: true, currency: 'INR' };
  });
}
export function pageOptions(query = {}) {
  const page = Number(query.page ?? 1), limit = Number(query.limit ?? 12);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1) fail('Invalid page or limit.');
  return { page: Math.min(page, 100000), limit: Math.min(limit, 50) };
}
export async function calculateUserImpact(userId, query = {}) {
  const { page, limit } = pageOptions(query);
  const records = await Contribution.find({ ...confirmedFilter, userId }).lean();
  const totals = sumContributions(records), projectIds = [...new Set(records.map(c => String(c.projectId)))];
  const projects = await Project.find({ _id: { $in: projectIds } }).select('title category status').lean();
  const completedProjects = projects.filter(p => p.status === 'completed');
  const total = await Contribution.countDocuments({ userId });
  const timeline = await Contribution.find({ userId }).select('-idempotencyKey -requestFingerprint -reviewedBy').populate('projectId', 'title status').populate('problemId', 'title linkedProjectId').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean();
  return { ...totals, totalVolunteerHours: totals.totalHours, totalMoneyContributed: totals.money,
    totalContributionsByType: totals.byType, problemsParticipatedIn: { count: projects.length, list: projects },
    completedProjectsCount: completedProjects.length, completedProjects, timeline, page, total, totalPages: Math.ceil(total / limit), simulated: true, currency: 'INR' };
}
export async function getImpactRecord(projectId) {
  validId(projectId);
  const project = await Project.findById(projectId).select('status').lean();
  const record = project?.status === 'completed' && await ImpactRecord.findOne({ projectId }).select('-__v -metricName -value').lean();
  if (!record) fail('No completed impact record found.', 404); return record;
}
export async function listImpactRecords(query = {}) {
  const { page, limit } = pageOptions(query), filter = { projectId: { $ne: null } };
  for (const [key, path] of [['category', 'category'], ['location', 'location.city']]) if (query[key]) {
    if (typeof query[key] !== 'string' || query[key].length > 100) fail(`Invalid ${key}.`);
    filter[path] = { $regex: query[key].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  const completed = await Project.find({ status: 'completed' }).select('_id').lean(); filter.projectId = { $in: completed.map(p => p._id) };
  const total = await ImpactRecord.countDocuments(filter);
  const items = await ImpactRecord.find(filter).select('-__v -metricName -value').sort({ completedAt: -1, createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean();
  return { items, total, page, totalPages: Math.ceil(total / limit) };
}
