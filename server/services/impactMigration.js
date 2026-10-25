import Contribution from '../models/Contribution.js';
import ImpactRecord from '../models/ImpactRecord.js';
import Project from '../models/Project.js';
import Problem from '../models/Problem.js';
import { strictTransaction } from '../utils/strictTransaction.js';
import { lockProject, calculateProjectProgress, generateImpactRecord, refreshContributionStats, milestoneProgress } from './impactCalculations.js';

export async function migrateContributionRecords(filter = {}, session = null) {
  // Raw lean documents distinguish missing stored version from Mongoose defaults.
  const rows = await Contribution.find({ ...filter, $or: [{ schemaVersion: { $ne: 2 } }, { projectId: null }] }).session(session).lean();
  for (const c of rows) {
    const problem = c.problemId && await Problem.findById(c.problemId).select('linkedProjectId').session(session).lean();
    const patch = { projectId: c.projectId || problem?.linkedProjectId || null };
    if (c.schemaVersion !== 2) Object.assign(patch, { schemaVersion: 2, status: 'pending', legacyNeedsReview: true, legacyReason: c.type === 'money' ? 'Original currency was not recorded. Confirm INR and the amount before counting.' : 'Structured hours, skills or item quantities were not recorded. Supply known details before confirming.' });
    await Contribution.updateOne({ _id: c._id }, { $set: patch }, { session, timestamps: false });
  }
}
export async function migrationReport() {
  return { legacyRecords: await Contribution.countDocuments({ schemaVersion: { $ne: 2 } }),
    awaitingProject: await Contribution.countDocuments({ projectId: null }),
    awaitingReview: await Contribution.countDocuments({ legacyNeedsReview: true }),
    completedWithoutSnapshot: await Project.aggregate([{ $match: { status: 'completed' } }, { $lookup: { from: 'impactrecords', localField: '_id', foreignField: 'projectId', as: 'snapshots' } }, { $match: { snapshots: { $size: 0 } } }, { $count: 'count' }]).then(rows => rows[0]?.count || 0) };
}
export async function hasPendingProgressReconciliation() {
  for await (const project of Project.find().select('milestones progressPercentage').lean().cursor()) {
    if (project.progressPercentage !== milestoneProgress(project.milestones)) return true;
  }
  return false;
}
export async function prepareImpact({ indexesOnly = false } = {}) {
  await Contribution.createIndexes(); await ImpactRecord.createIndexes();
  if (indexesOnly) return; // Do not run either migration or reconciliation without transactions.
  // Per-record conversion is resumable, never deletes data, and leaves historical dates intact.
  await migrateContributionRecords();
  for await (const p of Project.find().select('_id').cursor()) {
    await strictTransaction(async session => {
      const project = await lockProject(p._id, session);
      await calculateProjectProgress(p._id, session);
      if (project.status === 'completed') await generateImpactRecord(p._id, session, !project.completedAt);
      else await refreshContributionStats(p._id, session);
    });
  }
}
