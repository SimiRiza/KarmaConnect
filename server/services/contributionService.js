import { createNotification } from './notificationService.js';
import { createHash } from 'node:crypto';
import Contribution from '../models/Contribution.js';
import Project from '../models/Project.js';
import Problem from '../models/Problem.js';
import Team from '../models/Team.js';
import { validateContribution } from './contributionValidation.js';
import { fail, validId, paise } from './resourceValidation.js';
import { aggregateProjectFunding, lockProject, refreshContributionStats, pageOptions } from './impactCalculations.js';
import { strictTransaction } from '../utils/strictTransaction.js';
const same = (a, b) => String(a) === String(b);
const safe = record => { const value = record.toObject ? record.toObject() : { ...record }; delete value.requestFingerprint; delete value.idempotencyKey; return value; };
export async function createContribution(userId, projectId, data, key) {
  validId(projectId); const payload = validateContribution(data);
  if (data.userId !== undefined || data.status !== undefined || data.projectId !== undefined || data.legacyNeedsReview !== undefined) fail('Contribution owner, project and status are server-controlled.');
  if (typeof key !== 'string' || !/^[\w-]{8,100}$/.test(key)) fail('A valid Idempotency-Key is required.');
  const fingerprint = createHash('sha256').update(JSON.stringify({ projectId: String(projectId), ...payload })).digest('hex');
  const retry = c => { if (c.requestFingerprint !== fingerprint) fail('Request key already used for different contribution data.', 409); return safe(c); };
  try { return await strictTransaction(async session => {
    const previous = await Contribution.findOne({ userId, idempotencyKey: key }).select('+requestFingerprint').session(session);
    if (previous) return retry(previous);
    const project = await lockProject(projectId, session);
    if (project.status === 'completed') fail('Completed projects cannot receive new contributions.', 409);
    if (['time', 'skills'].includes(payload.type) && !await Team.exists({ projectId, 'members.userId': userId }).session(session)) fail('Join the project team before logging time or skills.', 403);
    if (payload.type === 'money') {
      const funding = await aggregateProjectFunding(projectId, session);
      if (paise(payload.moneyContributed.amount) > paise(project.fundingRequired) - paise(funding.total)) fail('Contribution exceeds the current funding gap.', 409);
    }
    const [record] = await Contribution.create([{ userId, projectId, ...payload, status: payload.type === 'materials' ? 'pending' : 'confirmed', idempotencyKey: key, requestFingerprint: fingerprint }], { session });
    await refreshContributionStats(projectId, session, true);
    await createNotification({ userId, type: 'contribution_recorded', title: 'Contribution recorded', message: project.title, relatedProjectId: projectId }, { session, key: 'recorded:' + record._id });
    await createNotification({ userId: project.ngoId, type: 'new_contribution', title: 'New contribution', message: project.title, relatedProjectId: projectId, relatedUserId: userId }, { session, key: 'new-contribution:' + record._id });
    if (record.status === 'confirmed') await createNotification({ userId, type: 'contribution_confirmed', title: 'Contribution confirmed', message: project.title, relatedProjectId: projectId }, { session, key: 'confirmed:' + record._id });
    return safe(record);
  }); } catch (error) {
    if (error.code === 11000) { const existing = await Contribution.findOne({ userId, idempotencyKey: key }).select('+requestFingerprint'); if (existing) return retry(existing); }
    throw error;
  }
}
export async function listContributions(userId, projectId, query = {}) {
  const p = await Project.findById(validId(projectId)).select('ngoId');
  if (!p) fail('Project not found.', 404);
  if (!same(p.ngoId, userId) && !await Team.exists({ projectId, 'members.userId': userId })) fail('Only the managing NGO and current team members may view contributors.', 403);
  const { page, limit } = pageOptions(query), filter = { projectId };
  if (query.status) { if (!['pending', 'confirmed', 'rejected'].includes(query.status)) fail('Invalid status.'); filter.status = query.status; }
  if (query.type) { if (!['time', 'skills', 'money', 'materials'].includes(query.type)) fail('Invalid contribution type.'); filter.type = query.type; }
  const total = await Contribution.countDocuments(filter);
  const items = await Contribution.find(filter).select('-requestFingerprint -idempotencyKey').populate('userId', 'name profilePhotoUrl').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean();
  return { items, total, page, totalPages: Math.ceil(total / limit) };
}
export const reviewContribution = (userId, projectId, contributionId, data) => strictTransaction(async session => {
  const p = await lockProject(projectId, session);
  if (!same(p.ngoId, userId)) fail('Only the managing NGO can review contributions.', 403);
  if (!['confirmed', 'rejected'].includes(data.status)) fail('Choose confirmed or rejected.');
  const c = await Contribution.findOne({ _id: validId(contributionId), projectId }).session(session);
  if (!c) fail('Contribution not found.', 404);
  if (c.status !== 'pending') { if (c.status === data.status) return safe(c); fail('This contribution already has a final decision.', 409); }
  if (c.legacyNeedsReview && data.status === 'confirmed') {
    if (c.type === 'money' && data.currency !== 'INR') fail('Explicitly confirm the legacy currency as INR.');
    const repaired = validateContribution({ ...data, type: c.type });
    Object.assign(c, repaired); c.legacyNeedsReview = false;
    if (c.type === 'money') c.legacyCurrencyConfirmed = 'INR';
  }
  if (data.status === 'confirmed' && c.type === 'money') {
    const funding = await aggregateProjectFunding(projectId, session);
    // Historical records are retained even where the original goal has since decreased.
    if (!c.legacyReason && paise(c.moneyContributed.amount) > paise(p.fundingRequired) - paise(funding.total)) fail('Confirmation exceeds the current funding gap.', 409);
  }
  c.status = data.status; c.reviewedBy = userId; c.reviewedAt = new Date(); await c.save({ session });
  if (c.status === 'confirmed') await createNotification({ userId: c.userId, type: 'contribution_confirmed', title: 'Contribution confirmed', message: p.title, relatedProjectId: projectId, relatedUserId: userId }, { session, key: 'confirmed:' + c._id });
  await refreshContributionStats(projectId, session, true); return safe(c);
});
export async function contributeToLegacyProblem(userId, problemId, data, key) {
  const p = await Problem.findById(validId(problemId)).select('linkedProjectId');
  if (!p) fail('Problem not found.', 404);
  if (!p.linkedProjectId) fail('Contributions can be logged after an NGO adopts this problem into a project.', 409);
  return createContribution(userId, p.linkedProjectId, data, key);
}
