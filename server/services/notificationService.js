import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Project from '../models/Project.js';
import { fail, validId } from './resourceValidation.js';
import { strictTransaction } from '../utils/strictTransaction.js';
// Deliberately in-app polling only: no email, push, SMS or WebSocket delivery.
// Call inside the business transaction. Dedupe keys identify events, not messages.
export async function createNotification({ userId, type, title, message, relatedProjectId = null, relatedUserId = null }, { session = null, key } = {}) {
 if (type === 'report_received' && !await User.exists({ _id: userId, role: 'admin' }).session(session)) fail('Report notifications are admin-only.', 403);
 const data = { userId, type, title: title?.slice(0, 160), message: message?.slice(0, 2000), relatedProjectId, relatedUserId };
 if (key) {
  return Notification.findOneAndUpdate({ userId, dedupeKey: key }, { $setOnInsert: data }, { upsert: true, new: true, runValidators: true, session });
 }
 const [record] = await Notification.create([data], { session }); return record;
}
export function pagination(query = {}) {
 const page = Number(query.page ?? 1), limit = Number(query.limit ?? 20);
 if (!Number.isInteger(page) || page < 1 || page > 100000 || !Number.isInteger(limit) || limit < 1 || limit > 50) fail('Invalid pagination.');
 return { page, limit };
}
export async function listNotifications(userId, query) {
 const { page, limit } = pagination(query), filter = { userId };
 if (query.isRead !== undefined) { if (!['true','false'].includes(query.isRead)) fail('Invalid read filter.'); filter.isRead = query.isRead === 'true'; }
 const total = await Notification.countDocuments(filter);
 return { items: await Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(), page, total, totalPages: Math.ceil(total / limit) };
}
export async function markNotification(userId, id, isRead = true) {
 if (typeof isRead !== 'boolean') fail('isRead must be a boolean.');
 const item = await Notification.findOneAndUpdate({ _id: validId(id), userId }, { $set: { isRead } }, { new: true });
 if (!item) fail('Notification not found.', 404); return { item };
}
export async function removeNotification(userId, id) {
 const item = await Notification.findOneAndDelete({ _id: validId(id), userId });
 if (!item) fail('Notification not found.', 404); return {};
}
export async function checkMilestones(userId) {
 // Dashboard/bell-load check, no scheduler. Each due date gets one reminder.
 const now = new Date(), end = new Date(+now + 48 * 3600000);
 const projects = await Project.find({ ngoId: userId, status: { $ne: 'completed' }, milestones: { $elemMatch: { completed: false, targetDate: { $gte: now, $lte: end } } } }).select('_id').lean();
 for (const p of projects) await strictTransaction(async session => {
  const project = await Project.findOneAndUpdate({ _id: p._id, ngoId: userId }, { $inc: { __v: 1 } }, { new: true, session });
  if (!project || project.status === 'completed') return;
  for (const m of project.milestones) if (!m.completed && m.targetDate >= now && m.targetDate <= end) await createNotification({ userId, type: 'milestone_reminder', title: 'Milestone due soon', message: project.title + ': ' + m.title, relatedProjectId: project._id }, { session, key: 'milestone:' + m._id + ':' + m.targetDate.toISOString() });
 });
}
