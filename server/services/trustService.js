import User from '../models/User.js';
import Problem from '../models/Problem.js';
import Project from '../models/Project.js';
import NGOProfile from '../models/NGOProfile.js';
import CSRProfile from '../models/CSRProfile.js';
import Report, { TARGET_TYPES, REPORT_REASONS, REPORT_STATUSES } from '../models/Report.js';
import Notification from '../models/Notification.js';
import { largeProjectThreshold } from '../utils/verificationFields.js';
import { strictTransaction } from '../utils/strictTransaction.js';
import { fail, validId } from './resourceValidation.js';
import { createNotification, pagination } from './notificationService.js';
const targets = { problem: Problem, project: Project, user: User, ngo: NGOProfile, csr_profile: CSRProfile };
export function profileModel(type) { if (!['ngo','csr'].includes(type)) fail('Profile type must be ngo or csr.'); return type === 'ngo' ? NGOProfile : CSRProfile; }
function text(value, label, max, required = true) { if (typeof value !== 'string' || value.length > max || required && !value.trim()) fail('Invalid ' + label + '.'); return value.trim(); }
export async function prepareTrust() {
 const threshold = largeProjectThreshold();
 await Notification.createIndexes(); await Report.createIndexes();
 const required = { $gt: [{ $ifNull: ['$fundingRequired', 0] }, threshold] };
 await Project.updateMany({ $expr: { $ne: [{ $ifNull: ['$requiresAuthorityApproval', null] }, required] } }, [{ $set: { requiresAuthorityApproval: required } }], { timestamps: false });
}
export const addEvidence = (userId, type, evidenceType, files) => strictTransaction(async session => {
 const Model = profileModel(type);
 if (!['registration_doc','reference_letter','other'].includes(evidenceType)) fail('Choose a valid evidence type.');
 if (!files?.length) fail('Choose at least one document.');
 const profile = await Model.findOne({ userId }).select('+verificationEvidence').session(session);
 if (!profile) fail('Profile not found.', 404);
 if (profile.verificationEvidence.length + files.length > 20) fail('A profile may contain up to 20 verification documents.');
 const changed = profile.verificationStatus !== 'pending';
 for (const file of files) profile.verificationEvidence.push({ type: evidenceType, url: '/api/verification-evidence/' + type + '/' + profile._id + '/' + file.filename });
 profile.verificationStatus = 'pending'; await profile.save({ session });
 if (changed) await createNotification({ userId, type: 'verification_status_changed', title: 'Verification pending', message: 'Your documents have been submitted for administrator review.' }, { session });
 return { profile };
});
export async function ownEvidence(userId, type) {
 const profile = await profileModel(type).findOne({ userId }).select('+verificationEvidence').lean();
 if (!profile) fail('Profile not found.', 404); return { profile };
}
export async function pendingVerifications(query) {
 const { page, limit } = pagination(query);
 const rows = [];
 for (const type of ['ngo','csr']) {
  const profiles = await profileModel(type).find({ verificationStatus: 'pending' }).select('+verificationEvidence +verificationNotes').lean();
  rows.push(...profiles.map(profile => ({ ...profile, profileType: type })));
 }
 rows.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt) || String(b._id).localeCompare(String(a._id)));
 return { items: rows.slice((page-1)*limit,page*limit), total: rows.length, page, totalPages: Math.ceil(rows.length/limit) };
}
export const reviewVerification = (adminId, type, id, data) => strictTransaction(async session => {
 if (!['verified','rejected'].includes(data.verificationStatus)) fail('Choose verified or rejected.');
 const notes = text(data.verificationNotes ?? '', 'verification notes', 4000, true);
 const profile = await profileModel(type).findById(validId(id)).select('+verificationNotes +verificationEvidence').session(session);
 if (!profile) fail('Profile not found.', 404);
 const changed = profile.verificationStatus !== data.verificationStatus;
 profile.verificationStatus = data.verificationStatus; profile.verificationNotes = notes;
 profile.verificationReviewedAt = new Date(); profile.verificationReviewedBy = adminId;
 await profile.save({ session });
 if (changed) await createNotification({ userId: profile.userId, type: 'verification_status_changed', title: 'Verification ' + profile.verificationStatus, message: 'An administrator has reviewed your organization verification.', relatedUserId: adminId }, { session });
 // Internal notes are returned only by explicitly admin-scoped DTOs.
 return { profile: { ...profile.toObject(), verificationNotes: notes } };
});
export const verifyEvidence = (id) => strictTransaction(async session => {
 const project = await Project.findOneAndUpdate({ _id: validId(id) }, { $inc: { __v: 1 } }, { new: true, session });
 if (!project) fail('Project not found.', 404);
 if (!project.photos.before.length || !project.photos.after.length) fail('Before and after evidence are required.');
 project.evidenceVerified = true; await project.save({ session }); return { project };
});
export const createReport = (userId, data) => strictTransaction(async session => {
 if (!TARGET_TYPES.includes(data.targetType) || !REPORT_REASONS.includes(data.reason)) fail('Invalid report target or reason.');
 const description = text(data.description, 'description', 2000);
 if (!await targets[data.targetType].exists({ _id: validId(data.targetId) }).session(session)) fail('Report target not found.', 404);
 // Serialize per reporter so concurrent requests cannot evade the hourly limit.
 await User.updateOne({ _id: userId }, { $inc: { __v: 1 } }, { session });
 if (await Report.countDocuments({ reportedBy: userId, createdAt: { $gte: new Date(Date.now()-3600000) } }).session(session) >= 10) fail('Please wait before submitting another report.', 429);
 const [report] = await Report.create([{ reportedBy: userId, targetType: data.targetType, targetId: data.targetId, reason: data.reason, description }], { session });
 for (const admin of await User.find({ role: 'admin' }).select('_id').session(session)) await createNotification({ userId: admin._id, type: 'report_received', title: 'New report awaiting review', message: 'A ' + data.targetType.replaceAll('_',' ') + ' was reported for ' + data.reason.replaceAll('_',' ') + '.' }, { session, key: 'report:' + report._id });
 return { report: { _id: report._id, status: report.status } };
});
export async function listReports(query) {
 const { page, limit } = pagination(query), filter = {};
 for (const [key, values] of [['status',REPORT_STATUSES],['targetType',TARGET_TYPES]]) if (query[key] !== undefined) { if (!values.includes(query[key])) fail('Invalid report filter.'); filter[key] = query[key]; }
 const total = await Report.countDocuments(filter);
 const items = await Report.aggregate([{ $match: filter }, { $addFields: { pendingOrder: { $cond: [{ $eq: ['$status','pending'] },0,1] } } }, { $sort: { pendingOrder: 1, createdAt: -1, _id: -1 } }, { $skip: (page-1)*limit }, { $limit: limit }, { $unset: 'pendingOrder' }]);
 return { items, total, page, totalPages: Math.ceil(total/limit) };
}
export const reviewReport = (adminId, id, data) => strictTransaction(async session => {
 if (!REPORT_STATUSES.includes(data.status)) fail('Invalid report status.');
 if (data.flagTarget !== undefined && typeof data.flagTarget !== 'boolean') fail('flagTarget must be a boolean.');
 const report = await Report.findById(validId(id)).session(session); if (!report) fail('Report not found.', 404);
 if (data.flagTarget) {
  if (data.status !== 'action_taken' || !['problem','project'].includes(report.targetType)) fail('Only problems/projects may be flagged with action_taken.');
  const result = await targets[report.targetType].updateOne({ _id: report.targetId }, { $set: { isFlagged: true } }, { session });
  if (!result.matchedCount) fail('Report target no longer exists.', 404);
 }
 report.status = data.status; report.reviewedBy = adminId; report.reviewNotes = text(data.reviewNotes ?? '', 'review notes', 4000, false);
 await report.save({ session }); return { report };
});
export async function projectTrust(id) {
 const p = await Project.findById(validId(id)).select('ngoId evidenceVerified requiresAuthorityApproval fundedBy').lean();
 if (!p) fail('Project not found.',404);
 const ngo = await NGOProfile.findOne({ userId: p.ngoId }).select('ngoName verificationStatus userId').lean();
 const companies = await CSRProfile.find({ userId: { $in: p.fundedBy } }).select('companyName verificationStatus userId').lean();
 return { evidenceVerified: p.evidenceVerified, requiresAuthorityApproval: p.requiresAuthorityApproval, ngo, companies };
}
