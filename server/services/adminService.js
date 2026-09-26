import { literal } from './problemDiscovery.js';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import NGOProfile from '../models/NGOProfile.js';
import CSRProfile from '../models/CSRProfile.js';
import CommunityUserProfile from '../models/CommunityUserProfile.js';
import Project from '../models/Project.js';
import Problem, { PROBLEM_CATEGORIES } from '../models/Problem.js';
import Funding from '../models/Funding.js';
import Contribution from '../models/Contribution.js';
import ImpactRecord from '../models/ImpactRecord.js';
import Report from '../models/Report.js';
import { confirmedFilter } from './contributionAggregates.js';
import { strictTransaction } from '../utils/strictTransaction.js';
import { fail, validId } from './resourceValidation.js';
import { pagination } from './notificationService.js';
import { profileModel } from './trustService.js';
const roles = ['community_user', 'ngo', 'csr_manager', 'admin'];
const userFields = 'name email role isSuspended isEmailVerified location.city createdAt profilePhotoUrl';
export function adminCredentials(data) {
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) fail('Enter a valid email address.');
  if (typeof data.password !== 'string' || data.password.length < 8 || Buffer.byteLength(data.password) > 72) fail('Password must contain at least 8 characters and at most 72 UTF-8 bytes.');
  const name = data.name ?? 'Platform Administrator';
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) fail('Name must be between 2 and 100 characters.');
  return {
    name: name.trim(),
    email,
    password: data.password
  };
}
export async function createAdmin(data, bootstrap = false) {
  if (bootstrap && (await User.exists({
    role: 'admin'
  }))) return {
    created: false
  };
  const credentials = adminCredentials(data),
    passwordHash = await bcrypt.hash(credentials.password, 12);
  await User.init();
  try {
    return await strictTransaction(async session => {
      if (bootstrap && (await User.exists({
        role: 'admin'
      }).session(session))) return {
        created: false
      };
      if (await User.exists({
        email: credentials.email
      }).session(session)) fail('Email is already registered; existing accounts are never promoted.', 409);
      const [user] = await User.create([{
        name: credentials.name,
        email: credentials.email,
        passwordHash,
        role: 'admin',
        isEmailVerified: true,
        ...(bootstrap ? {
          bootstrapAdmin: true
        } : {})
      }], {
        session
      });
      return {
        created: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      };
    });
  } catch (error) {
    if (error.code === 11000 && bootstrap && (await User.exists({
      role: 'admin'
    }))) return {
      created: false
    };
    throw error;
  }
}
async function profilesFor(users) {
  const ids = users.map(u => u._id);
  const profiles = [...(await NGOProfile.find({
    userId: {
      $in: ids
    }
  }).lean()), ...(await CSRProfile.find({
    userId: {
      $in: ids
    }
  }).lean()), ...(await CommunityUserProfile.find({
    userId: {
      $in: ids
    }
  }).lean())];
  return users.map(u => ({
    ...u,
    profile: profiles.find(p => String(p.userId) === String(u._id)) || null
  }));
}
export async function usersList(query) {
  const {
      page,
      limit
    } = pagination(query),
    filter = {};
  if (query.role) {
    if (!roles.includes(query.role)) fail('Invalid role.');
    filter.role = query.role;
  }
  if (query.search) {
    if (typeof query.search !== 'string' || query.search.length > 150) fail('Invalid search.');
    const escaped = literal(query.search);
    filter.$or = [{
      name: {
        $regex: escaped,
        $options: 'i'
      }
    }, {
      email: {
        $regex: escaped,
        $options: 'i'
      }
    }];
  }
  const total = await User.countDocuments(filter),
    rows = await User.find(filter).select(userFields).sort({
      createdAt: -1,
      _id: -1
    }).skip((page - 1) * limit).limit(limit).lean();
  return {
    items: await profilesFor(rows),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}
export async function userDetail(id) {
  const user = await User.findById(validId(id)).select(userFields).lean();
  if (!user) fail('User not found.', 404);
  return {
    user: (await profilesFor([user]))[0]
  };
}
export const suspendUser = (actorId, id, suspended) => strictTransaction(async session => {
  validId(id);
  if (suspended && String(actorId) === String(id)) fail('You cannot suspend your own account.', 409);
  // Serialize admin changes using the same ordered set of admin records; recheck actor after locking.
  const admins = await User.find({
    role: 'admin'
  }).select('_id').sort({
    _id: 1
  }).session(session);
  for (const a of admins) await User.updateOne({
    _id: a._id
  }, {
    $inc: {
      __v: 1
    }
  }, {
    session
  });
  if (!(await User.exists({
    _id: actorId,
    role: 'admin',
    isSuspended: {
      $ne: true
    }
  }).session(session))) fail('Administrator access required.', 403);
  const user = await User.findById(id).session(session);
  if (!user) fail('User not found.', 404);
  if (suspended && !user.isSuspended && user.role === 'admin' && (await User.countDocuments({
    role: 'admin',
    isSuspended: {
      $ne: true
    }
  }).session(session)) <= 1) fail('The last active administrator cannot be suspended.', 409);
  user.isSuspended = suspended;
  if (suspended) user.refreshTokens = [];
  await user.save({
    session
  });
  return {
    user: {
      _id: user._id,
      isSuspended: user.isSuspended
    }
  };
});
const group = async (Model, field) => Object.fromEntries((await Model.aggregate([{
  $group: {
    _id: '$' + field,
    count: {
      $sum: 1
    }
  }
}])).map(r => [r._id, r.count]));
const sum = async (Model, match, field) => (await Model.aggregate([{
  $match: match
}, {
  $group: {
    _id: null,
    total: {
      $sum: field
    }
  }
}]))[0]?.total || 0;
export async function overview() {
  const [users, problems, projects, ngos, companies] = await Promise.all([group(User, 'role'), group(Problem, 'status'), group(Project, 'status'), group(NGOProfile, 'verificationStatus'), group(CSRProfile, 'verificationStatus')]);
  const [csrAllocated, volunteerDonations, volunteerHours, beneficiaries, pendingReports] = await Promise.all([sum(Funding, {
    status: {
      $ne: 'withdrawn'
    }
  }, '$amountAllocated'), sum(Contribution, confirmedFilter, '$moneyContributed.amount'), sum(Contribution, confirmedFilter, {
    $add: [{
      $ifNull: ['$timeContributed.hours', 0]
    }, {
      $ifNull: ['$skillsContributed.hoursEquivalent', 0]
    }]
  }), sum(ImpactRecord, {
    projectId: {
      $type: 'objectId'
    }
  }, '$beneficiariesReached'), Report.countDocuments({
    status: 'pending'
  })]);
  return {
    users,
    problems,
    projects,
    ngos,
    companies,
    csrAllocated,
    volunteerDonations,
    totalFunding: Math.round((csrAllocated + volunteerDonations) * 100) / 100,
    volunteerHours,
    beneficiaries,
    completedProjects: projects.completed || 0,
    pendingReports,
    pendingVerifications: (ngos.pending || 0) + (companies.pending || 0),
    suspendedUsers: await User.countDocuments({
      isSuspended: true
    }),
    simulated: true,
    currency: 'INR'
  };
}
export async function growth(query) {
  const interval = query.interval || 'month';
  if (!['week', 'month'].includes(interval)) fail('Interval must be week or month.');
  const now = new Date(),
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (interval === 'month') end.setUTCDate(1);else end.setUTCDate(end.getUTCDate() - (end.getUTCDay() + 6) % 7);
  const starts = Array.from({
    length: 12
  }, (_, i) => {
    const d = new Date(end);
    if (interval === 'month') d.setUTCMonth(d.getUTCMonth() - 11 + i);else d.setUTCDate(d.getUTCDate() - (11 - i) * 7);
    return d;
  });
  const periods = starts.map((start, i) => {
    const stop = starts[i + 1] || new Date(end);
    if (!starts[i + 1]) {
      if (interval === 'month') stop.setUTCMonth(stop.getUTCMonth() + 1);else stop.setUTCDate(stop.getUTCDate() + 7);
    }
    return {
      start,
      end: stop,
      newUsers: 0,
      newProjects: 0
    };
  });
  for (const [Model, key] of [[User, 'newUsers'], [Project, 'newProjects']]) {
    const rows = await Model.aggregate([{
      $match: {
        createdAt: {
          $gte: starts[0]
        }
      }
    }, {
      $group: {
        _id: {
          $dateTrunc: {
            date: '$createdAt',
            unit: interval,
            timezone: 'UTC',
            ...(interval === 'week' ? {
              startOfWeek: 'monday'
            } : {})
          }
        },
        count: {
          $sum: 1
        }
      }
    }]);
    for (const row of rows) {
      const p = periods.find(p => +p.start === +row._id);
      if (p) p[key] = row.count;
    }
  }
  return {
    interval,
    timezone: 'UTC',
    items: periods
  };
}
export async function categories() {
  // Truly dynamic categories require migrating enum fields to a reference collection.
  const [problems, projects] = await Promise.all([group(Problem, 'category'), group(Project, 'category')]);
  return {
    items: PROBLEM_CATEGORIES.map(name => ({
      name,
      problems: problems[name] || 0,
      projects: projects[name] || 0,
      total: (problems[name] || 0) + (projects[name] || 0)
    }))
  };
}
export async function verifications(query) {
  const status = query.status || 'pending';
  if (!['pending', 'verified', 'rejected'].includes(status)) fail('Invalid verification status.');
  const {
    page,
    limit
  } = pagination(query);
  const rows = [];
  for (const type of ['ngo', 'csr']) rows.push(...(await profileModel(type).find({
    verificationStatus: status
  }).select('+verificationEvidence +verificationNotes').lean()).map(p => ({
    ...p,
    profileType: type
  })));
  rows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt) || String(b._id).localeCompare(String(a._id)));
  return {
    items: rows.slice((page - 1) * limit, page * limit),
    total: rows.length,
    page,
    totalPages: Math.ceil(rows.length / limit)
  };
}
export async function reportDetail(id) {
  const report = await Report.findById(validId(id)).populate('reportedBy', 'name email').lean();
  if (!report) fail('Report not found.', 404);
  const Model = {
    problem: Problem,
    project: Project,
    user: User,
    ngo: NGOProfile,
    csr_profile: CSRProfile
  }[report.targetType];
  const target = await Model.findById(report.targetId).select(report.targetType === 'user' ? userFields : undefined).lean();
  return {
    report,
    target,
    targetMissing: !target
  };
}
export async function evidenceQueue(query) {
  const {
      page,
      limit
    } = pagination(query),
    filter = {
      requiresAuthorityApproval: true,
      evidenceVerified: {
        $ne: true
      }
    },
    total = await Project.countDocuments(filter);
  return {
    items: await Project.find(filter).select('title description photos fundingRequired ngoId status').populate('ngoId', 'name').sort({
      createdAt: -1,
      _id: -1
    }).skip((page - 1) * limit).limit(limit).lean(),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}
