import mongoose from 'mongoose';
import Funding from '../models/Funding.js';
import Project from '../models/Project.js';
import CSRProfile from '../models/CSRProfile.js';
import { strictTransaction } from '../utils/strictTransaction.js';
export const fail = (message, statusCode = 400) => {
  throw Object.assign(new Error(message), {
    statusCode
  });
};
export const validId = value => {
  if (!mongoose.isValidObjectId(value)) fail('Invalid record ID.');
  return value;
};
export const paise = value => Math.round(value * 100);
export const money = (value, positive = false) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < (positive ? 0.01 : 0) || value > 100000000000 || Math.abs(value * 100 - paise(value)) > 0.0001) fail('Use an INR amount with at most two decimal places.');
  return paise(value);
};
export async function portfolioSummary(userId, session = null) {
  const [result] = await Funding.aggregate([{
    $match: {
      csrUserId: new mongoose.Types.ObjectId(String(userId)),
      status: {
        $ne: 'withdrawn'
      }
    }
  }, {
    $group: {
      _id: '$projectId',
      allocated: {
        $sum: '$amountAllocated'
      },
      spent: {
        $sum: '$amountSpentSoFar'
      }
    }
  }, {
    $lookup: {
      from: 'projects',
      localField: '_id',
      foreignField: '_id',
      as: 'project'
    }
  }, {
    $unwind: '$project'
  }, {
    $facet: {
      totals: [{
        $group: {
          _id: null,
          totalBudgetAllocated: {
            $sum: '$allocated'
          },
          totalAmountSpent: {
            $sum: '$spent'
          },
          activeProjectsCount: {
            $sum: {
              $cond: [{
                $ne: ['$project.status', 'completed']
              }, 1, 0]
            }
          },
          completedProjectsCount: {
            $sum: {
              $cond: [{
                $eq: ['$project.status', 'completed']
              }, 1, 0]
            }
          },
          totalBeneficiariesReached: {
            $sum: {
              $cond: [{
                $eq: ['$project.status', 'completed']
              }, '$project.beneficiaries.estimatedCount', 0]
            }
          },
          estimatedBeneficiaries: {
            $sum: {
              $cond: [{
                $ne: ['$project.status', 'completed']
              }, '$project.beneficiaries.estimatedCount', 0]
            }
          },
          volunteersInvolvedCount: {
            $sum: {
              $size: {
                $ifNull: ['$project.teamMembers', []]
              }
            }
          },
          ngos: {
            $addToSet: '$project.ngoId'
          }
        }
      }],
      projectsByStatus: [{
        $group: {
          _id: '$project.status',
          count: {
            $sum: 1
          }
        }
      }],
      projects: [{
        $project: {
          _id: 1,
          title: '$project.title',
          ngoId: '$project.ngoId',
          status: '$project.status',
          allocated: 1,
          spent: 1,
          remaining: {
            $subtract: ['$allocated', '$spent']
          }
        }
      }]
    }
  }]).session(session);
  const totals = result?.totals[0] || {};
  return {
    simulated: true,
    currency: 'INR',
    totalBudgetAllocated: paise(totals.totalBudgetAllocated || 0) / 100,
    totalAmountSpent: paise(totals.totalAmountSpent || 0) / 100,
    remaining: paise((totals.totalBudgetAllocated || 0) - (totals.totalAmountSpent || 0)) / 100,
    activeProjectsCount: totals.activeProjectsCount || 0,
    completedProjectsCount: totals.completedProjectsCount || 0,
    totalBeneficiariesReached: totals.totalBeneficiariesReached || 0,
    estimatedBeneficiaries: totals.estimatedBeneficiaries || 0,
    totalNgosPartnered: totals.ngos?.length || 0,
    volunteersInvolvedCount: totals.volunteersInvolvedCount || 0,
    projectsByStatus: Object.fromEntries((result?.projectsByStatus || []).map(p => [p._id, p.count])),
    projects: result?.projects || [],
    generatedAt: new Date()
  };
}
export async function recalculateCsrStats(userId, session) {
  const summary = await portfolioSummary(userId, session);
  const fields = ['totalBudgetAllocated', 'totalAmountSpent', 'activeProjectsCount', 'completedProjectsCount', 'totalBeneficiariesReached', 'totalNgosPartnered'];
  await CSRProfile.updateOne({
    userId
  }, {
    $set: Object.fromEntries(fields.map(k => [k, summary[k]]))
  }, {
    session
  });
}
export async function recalculateProjectFunding(projectId, session) {
  // All callers must hold a write lock on this Project within the same transaction.
  const project = await Project.findById(projectId).session(session);
  const records = await Funding.find({
    projectId
  }).sort({
    allocationDate: 1,
    _id: 1
  }).session(session);
  if (!records.length) return project; // Preserve Prompt 3's unfunded resource tracking.
  const active = records.filter(f => f.status !== 'withdrawn');
  const received = active.reduce((sum, f) => sum + paise(f.amountAllocated), 0);
  // These are cumulative snapshots, NOT individual expenses. Never sum snapshots.
  const latest = [...(project.resourceUpdates || [])].reverse().find(r => typeof r.fundingSpent === 'number');
  const totalSpent = paise(latest?.fundingSpent ?? project.fundingSpent ?? 0);
  let remainingSpent = totalSpent;
  for (const f of active) {
    const attributed = Math.min(remainingSpent, paise(f.amountAllocated));
    f.amountSpentSoFar = attributed / 100;
    remainingSpent -= attributed;
    f.status = project.status === 'completed' ? 'completed' : project.status === 'in_progress' || attributed > 0 ? 'in_progress' : 'allocated';
    await f.save({
      session
    });
  }
  project.fundingReceived = received / 100;
  project.fundingSpent = totalSpent / 100; // Includes explicitly displayed unattributed historical spending.
  project.fundedBy = [...new Set(active.map(f => String(f.csrUserId)))];
  await project.save({
    session
  });
  const users = [...new Set(records.map(f => String(f.csrUserId)))].sort();
  // Serialize across different projects funded by the same CSR to prevent stale totals.
  for (const userId of users) await CSRProfile.updateOne({
    userId
  }, {
    $inc: {
      __v: 1
    }
  }, {
    session
  });
  for (const userId of users) await recalculateCsrStats(userId, session);
  return project;
}
const lockProject = async (id, session) => {
  const project = await Project.findOneAndUpdate({
    _id: validId(id)
  }, {
    $inc: {
      __v: 1
    }
  }, {
    new: true,
    session
  });
  if (!project) fail('Project not found.', 404);
  return project;
};
export async function allocateFunding(userId, projectId, data, key) {
  validId(projectId);
  const amount = money(data.amountAllocated, true);
  if (typeof key !== 'string' || !/^[\w-]{8,100}$/.test(key)) fail('A valid Idempotency-Key is required.');
  if (data.notes !== undefined && (typeof data.notes !== 'string' || data.notes.length > 2000)) fail('Notes must be at most 2000 characters.');
  const notes = (data.notes || '').trim();
  const checkRetry = f => {
    if (String(f.projectId) !== String(projectId) || paise(f.amountAllocated) !== amount || f.notes !== notes) fail('This request key was already used for a different allocation.', 409);
    return f;
  };
  try {
    return await strictTransaction(async session => {
      const previous = await Funding.findOne({
        csrUserId: userId,
        idempotencyKey: key
      }).session(session);
      if (previous) return checkRetry(previous);
      const project = await lockProject(projectId, session);
      const active = await Funding.find({
        projectId,
        status: {
          $ne: 'withdrawn'
        }
      }).session(session);
      const collected = active.reduce((n, f) => n + paise(f.amountAllocated), 0);
      if (project.status === 'completed') fail('Completed projects cannot receive new allocations.', 409);
      if (amount > paise(project.fundingRequired) - collected) fail('Allocation exceeds the current funding gap.', 409);
      // Replace with real payment gateway integration (e.g. Razorpay) before production.
      const [funding] = await Funding.create([{
        csrUserId: userId,
        projectId,
        amountAllocated: amount / 100,
        notes,
        idempotencyKey: key,
        status: 'allocated'
      }], {
        session
      });
      await recalculateProjectFunding(projectId, session);
      return Funding.findById(funding._id).session(session);
    });
  } catch (error) {
    if (error.code === 11000) {
      const previous = await Funding.findOne({
        csrUserId: userId,
        idempotencyKey: key
      });
      if (previous) return checkRetry(previous);
    }
    throw error;
  }
}
export const withdrawFunding = (userId, fundingId) => strictTransaction(async session => {
  const f = await Funding.findById(validId(fundingId)).session(session);
  if (!f) fail('Funding not found.', 404);
  if (String(f.csrUserId) !== String(userId)) fail('You do not own this allocation.', 403);
  if (f.status === 'withdrawn') return f;
  await lockProject(f.projectId, session);
  await recalculateProjectFunding(f.projectId, session);
  const current = await Funding.findById(f._id).session(session);
  if (current.status !== 'allocated' || current.amountSpentSoFar !== 0) fail('Only unspent allocations in allocated status can be withdrawn.', 409);
  current.status = 'withdrawn';
  await current.save({
    session
  });
  await recalculateProjectFunding(current.projectId, session);
  return current;
});
