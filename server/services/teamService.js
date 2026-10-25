import { createNotification } from './notificationService.js';
import Notification from '../models/Notification.js';
import { normalize, distinct } from './matchingUtils.js';
import mongoose from 'mongoose';
import Team from '../models/Team.js';
import Project from '../models/Project.js';
import User from '../models/User.js';
import CommunityUserProfile from '../models/CommunityUserProfile.js';
import { strictTransaction } from '../utils/strictTransaction.js';
import { fail, validId } from './fundingService.js';

const same = (a, b) => String(a) === String(b);
export function text(value, label, max = 2000, required = true) {
  if (typeof value !== 'string' || value.length > max || required && !value.trim()) fail(`Invalid ${label}.`);
  return value.trim();
}
function date(value, label, nullable = false) {
  if (nullable && (value === null || value === '')) return null;
  if (typeof value !== 'string' || !value || !Number.isFinite(+new Date(value))) fail(`Invalid ${label}.`);
  return new Date(value);
}

// Call within a transaction after locking Project. Existing teams always win over mirrors.
export async function ensureTeam(project, session) {
  let team = await Team.findOne({ projectId: project._id }).session(session);
  if (!team && project.teamMembers.length) {
    [team] = await Team.create([{ projectId: project._id, members: [...new Set(project.teamMembers.map(String))].map(userId => ({ userId, role: 'Volunteer' })) }], { session });
  }
  if (team) await syncTeam(project._id, team, session);
  return team;
}
export async function syncTeam(projectId, team, session) {
  await Project.updateOne({ _id: projectId }, { $set: { teamId: team._id, teamMembers: team.members.map(m => m.userId) } }, { session });
}
export async function acceptIntoTeam(project, application, session, alreadyAccepted) {
  let team = await ensureTeam(project, session);
  // Retrying a historical acceptance must never undo an explicit member removal.
  if (alreadyAccepted) return team;
  if (!team) [team] = await Team.create([{ projectId: project._id }], { session });
  if (!team.members.some(m => same(m.userId, application.userId))) {
    team.members.push({ userId: application.userId, role: application.contributionType === 'skills' ? 'Skill Contributor' : 'Volunteer' });
    await team.save({ session });
  }
  await syncTeam(project._id, team, session);
  return team;
}
export function pendingTeamBackfillQuery() {
  return Project.find({ 'teamMembers.0': { $exists: true }, teamId: null }).select('_id');
}
export async function prepareTeams({ indexesOnly = false } = {}) {
  await Team.createIndexes();
  if (indexesOnly) return; // Only selected by the validated standalone startup policy.
  // Resumable compatibility backfill: only projects with already-accepted volunteers.
  for await (const p of pendingTeamBackfillQuery().cursor()) {
    await strictTransaction(async session => {
      const project = await Project.findOneAndUpdate({ _id: p._id }, { $inc: { __v: 1 } }, { new: true, session });
      await ensureTeam(project, session);
    });
  }
}
async function access(userId, teamId, session) {
  const team = await Team.findById(validId(teamId)).select('-messages').session(session || null);
  if (!team) fail('Team not found.', 404);
  const project = await Project.findById(team.projectId).select('ngoId title').session(session || null);
  if (!project) fail('Project not found.', 404);
  const member = team.members.find(m => same(m.userId, userId));
  const owner = same(project.ngoId, userId);
  if (!owner && !member) fail('Only team members and the managing NGO can access this workspace.', 403);
  return { team, project, owner, coordinator: owner || member?.role === 'Coordinator' };
}

function cursorFilter(before) {
  if (!before) return null;
  if (typeof before !== 'string') fail('Invalid message cursor.');
  const [timestamp, id, extra] = before.split('|');
  if (extra || !Number.isFinite(+new Date(timestamp))) fail('Invalid message cursor.');
  if (!id) return { $lt: ['$$m.sentAt', new Date(timestamp)] };
  validId(id);
  return { $or: [{ $lt: ['$$m.sentAt', new Date(timestamp)] }, { $and: [{ $eq: ['$$m.sentAt', new Date(timestamp)] }, { $lt: ['$$m._id', new mongoose.Types.ObjectId(id)] }] }] };
}
export async function messages(userId, teamId, before, session) {
  await access(userId, teamId, session);
  const filter = cursorFilter(before);
  const rows = await Team.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(teamId) } },
    { $project: { messages: { $slice: [{ $sortArray: { input: filter ? { $filter: { input: '$messages', as: 'm', cond: filter } } : '$messages', sortBy: { sentAt: -1, _id: -1 } } }, 51] } } }
  ]).session(session || null);
  const list = rows[0]?.messages || [], hasMore = list.length > 50;
  const page = list.slice(0, 50).reverse();
  const users = await User.find({ _id: { $in: page.map(m => m.senderId) } }).select('name profilePhotoUrl').session(session || null).lean();
  return { messages: page.map(m => ({ ...m, sender: users.find(u => same(u._id, m.senderId)) || { name: 'Former member' } })),
    nextCursor: hasMore ? `${page[0].sentAt.toISOString()}|${page[0]._id}` : null };
}
export async function detail(userId, teamId) {
  const { team, project, owner, coordinator } = await access(userId, teamId);
  const users = await User.find({ _id: { $in: team.members.map(m => m.userId) } }).select('name profilePhotoUrl location.city').lean();
  const profiles = await CommunityUserProfile.find({ userId: { $in: users.map(u => u._id) } }).select('userId skills availability bio').lean();
  return { ...team.toObject(), project, permissions: { owner, coordinator },
    members: team.members.map(m => ({ ...m.toObject(), user: users.find(u => same(u._id, m.userId)), profile: profiles.find(p => same(p.userId, m.userId)) })), ...await messages(userId, teamId) };
}

export const mutate = (userId, teamId, operation, target, data = {}) => strictTransaction(async session => {
  const initial = await Team.findById(validId(teamId)).select('projectId').session(session);
  if (!initial) fail('Team not found.', 404);
  // Same lock order as applicant acceptance and funding; recheck access after locking.
  await Project.updateOne({ _id: initial.projectId }, { $inc: { __v: 1 } }, { session });
  const { team, project, owner, coordinator } = await access(userId, teamId, session);
  if (operation === 'role' || operation === 'meeting') {
    if (!coordinator) fail('Only the managing NGO or a Coordinator can do this.', 403);
  }
  if (operation === 'remove' && !owner) fail('Only the managing NGO can remove members.', 403);
  if (operation === 'role' || operation === 'remove') {
    validId(target);
    const member = team.members.find(m => same(m.userId, target));
    if (!member) fail('Member not found.', 404);
    if (operation === 'role') member.role = text(data.role, 'member role', 80);
    else {
      team.members = team.members.filter(m => !same(m.userId, target));
      for (const task of team.tasks) if (same(task.assignedTo, target)) task.assignedTo = null;
    }
  } else if (operation === 'meeting') {
    team.meetingSchedule.push({ title: text(data.title, 'meeting title', 150), dateTime: date(data.dateTime, 'meeting date'), notes: text(data.notes ?? '', 'meeting notes', 2000, false) });
  } else if (operation === 'message') {
    // Polling-based, not real-time. Prompt 7 can hook into committed messages.
    const content = text(data.content, 'message', 4000);
    await Team.updateOne({ _id: team._id }, { $push: { messages: { _id: new mongoose.Types.ObjectId(), senderId: userId, content, sentAt: new Date() } } }, { session, runValidators: true });
    // Project write lock serializes this rolling 60-second throttle, including concurrent sends.
    const recipients = [...new Set([...team.members.map(m => String(m.userId)), String(project.ngoId)])].filter(id => id !== String(userId));
    for (const recipient of recipients) {
      const recent = await Notification.exists({ userId: recipient, type: 'new_team_message', relatedProjectId: team.projectId, relatedUserId: userId, createdAt: { $gt: new Date(Date.now() - 60000) } }).session(session);
      if (!recent) await createNotification({ userId: recipient, type: 'new_team_message', title: 'New team message', message: project.title + ': ' + content.slice(0, 300), relatedProjectId: team.projectId, relatedUserId: userId }, { session });
    }
    return { posted: true };
  } else {
    let task;
    if (operation === 'taskCreate') { team.tasks.push({ title: text(data.title, 'task title', 150) }); task = team.tasks.at(-1); }
    else { task = team.tasks.id(validId(target)); if (!task) fail('Task not found.', 404); }
    if (operation === 'taskDelete') task.deleteOne();
    else {
      if (data.title !== undefined) task.title = text(data.title, 'task title', 150);
      if (data.description !== undefined) task.description = text(data.description, 'task description', 2000, false);
      if (data.dueDate !== undefined) task.dueDate = date(data.dueDate, 'due date', true);
      if (data.status !== undefined) {
        if (!['todo', 'in_progress', 'done'].includes(data.status)) fail('Invalid task status.');
        task.status = data.status;
      }
      if (data.assignedTo !== undefined) {
        if (data.assignedTo !== null && !team.members.some(m => same(m.userId, data.assignedTo))) fail('Assign tasks to a current team member.');
        task.assignedTo = data.assignedTo;
      }
    }
  }
  await team.save({ session });
  if (['role', 'remove'].includes(operation)) await syncTeam(team.projectId, team, session);
  return { updated: true };
});

export const postSkillRequest = (userId, projectId, data) => strictTransaction(async session => {
  const project = await Project.findOneAndUpdate({ _id: validId(projectId) }, { $inc: { __v: 1 } }, { new: true, session });
  if (!project) fail('Project not found.', 404);
  if (!same(project.ngoId, userId)) fail('You do not own this project.', 403);
  if (project.status === 'completed') fail('This project is completed.', 409);
  if (typeof data.hoursNeeded !== 'number' || !Number.isFinite(data.hoursNeeded) || data.hoursNeeded < 0.1 || data.hoursNeeded > 100000) fail('Hours must be between 0.1 and 100000.');
  project.skillRequests.push({ skillNeeded: text(data.skillNeeded, 'skill', 100), hoursNeeded: data.hoursNeeded, description: text(data.description, 'description') });
  await project.save({ session });
  const request = project.skillRequests.at(-1), skill = normalize(request.skillNeeded);
  const profiles = await CommunityUserProfile.find().select('userId skills').session(session);
  for (const profile of profiles) if (distinct(profile.skills).some(s => s.includes(skill) || skill.includes(s))) await createNotification({ userId: profile.userId, type: 'skill_request_match', title: 'Your skills could help', message: project.title + ': ' + request.skillNeeded, relatedProjectId: project._id, relatedUserId: userId }, { session, key: 'skill:' + request._id });
  return request;
});
