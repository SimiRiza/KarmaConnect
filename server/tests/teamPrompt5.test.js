import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server.js';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import CommunityUserProfile from '../models/CommunityUserProfile.js';
import CSRProfile from '../models/CSRProfile.js';
import NGOProfile from '../models/NGOProfile.js';
import Project from '../models/Project.js';
import Problem from '../models/Problem.js';
import Application from '../models/Application.js';
import Team from '../models/Team.js';
import Funding from '../models/Funding.js';
import { prepareTeams } from '../services/teamService.js';
import { generateAccessToken } from '../utils/tokenUtils.js';

describe('Prompt 5 matching and team workspace', () => {
  const users = {}, tokens = {};
  const api = (method, path, who = 'ngo') => request(app)[method](path).set('Authorization', `Bearer ${tokens[who]}`);
  const project = (extra = {}) => Project.create({ ngoId: users.ngo._id, title: 'Community learning', description: 'Help local learners', category: 'education', location: { city: 'Pune' }, fundingRequired: 1000, ...extra });
  const apply = p => Application.create({ userId: users.member._id, projectId: p._id, contributionType: 'skills' });
  const accept = (p, a) => api('post', `/api/projects/${p._id}/accept-applicant/${a._id}`).send({});
  async function formed() { const p = await project(), a = await apply(p); const r = await accept(p, a); assert.equal(r.status, 200, r.text); return { p, a, id: r.body.project.teamId }; }
  before(async () => {
    process.env.NODE_ENV = 'test'; process.env.USE_IN_MEMORY_DB = 'true'; process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
    await connectDB();
    for (const [name, role] of [['ngo', 'ngo'], ['otherngo', 'ngo'], ['member', 'community_user'], ['second', 'community_user'], ['outsider', 'community_user'], ['csr', 'csr_manager']]) {
      users[name] = await User.create({ name, email: `${name}@team.test`, passwordHash: 'test-only', role, location: { city: 'Pune' } });
      tokens[name] = generateAccessToken(users[name]);
    }
    await CommunityUserProfile.create({ userId: users.member._id, subType: 'student', skills: ['Teaching', 'Web Development'], interests: ['education'], causeAreas: ['education'], availability: 'flexible' });
    await NGOProfile.create({ userId: users.ngo._id, ngoName: 'Learning NGO', registrationNumber: 'TEAM-TEST', verificationStatus: 'verified', previousProjectsCount: 4 });
    await CSRProfile.create({ userId: users.csr._id, companyName: 'CSR', csrManagerName: 'Manager', csrFocusAreas: ['education'], budgetRange: 'INR 500-2000' });
    await Promise.all([Team.init(), Project.init(), Application.init(), Funding.init()]);
  });
  beforeEach(async () => { await Promise.all([Team.deleteMany({}), Project.deleteMany({}), Problem.deleteMany({}), Application.deleteMany({}), Funding.deleteMany({})]); });
  after(disconnectDB);
  test('recommendation APIs score at least five candidates before limiting and deduplicate adopted problems', async () => {
    const source = await Problem.create({ postedBy: users.member._id, title: 'Learning', description: 'Needs help', category: 'education', location: { city: 'Pune' }, urgency: 'high' });
    const best = await project({ requiredSkills: ['Teaching'], sourceProblemId: source._id });
    await Problem.updateOne({ _id: source._id }, { linkedProjectId: best._id });
    for (let i = 0; i < 4; i++) await project({ category: i % 2 ? 'health' : 'education', fundingRequired: 5000 + i, location: { city: 'Delhi' } });
    await project({ status: 'completed' });
    let r = await api('get', '/api/users/me/recommended-projects?limit=1', 'member');
    assert.equal(r.status, 200, r.text); assert.equal(r.body.total, 5); assert.equal(r.body.items[0]._id, String(best._id)); assert.equal(r.body.items[0].matchScore, 10);
    r = await api('get', '/api/csr/me/recommended-projects?limit=1', 'csr');
    assert.equal(r.body.total, 5); assert.equal(r.body.items[0]._id, String(best._id)); assert.equal(r.body.items[0].matchScore, 8.5);
    const match = await api('post', '/api/csr/match-projects', 'csr').send({ limit: 1 });
    assert.deepEqual(match.body.items, r.body.items);
    assert.equal((await api('get', '/api/users/me/recommended-projects?limit=no', 'member')).status, 400);
    assert.equal((await api('get', '/api/csr/me/recommended-projects', 'member')).status, 403);
    assert.equal((await api('get', '/api/users/me/skill-matches', 'csr')).status, 403);
  });
  test('skill requests validate ownership/hours and match partial skills without completed/filled requests', async () => {
    const p = await project(), path = `/api/ngo/projects/${p._id}/skill-requests`;
    const data = { skillNeeded: ' WEB ', hoursNeeded: 10, description: 'Build a learning website' };
    assert.equal((await api('post', path, 'otherngo').send(data)).status, 403);
    assert.equal((await api('post', path).send({ ...data, hoursNeeded: 0 })).status, 400);
    assert.equal((await api('post', path).send(data)).status, 200);
    let r = await api('get', '/api/users/me/skill-matches', 'member');
    assert.equal(r.body.items.length, 1); assert.deepEqual(r.body.items[0].matchedSkills, ['web development']);
    await Project.updateOne({ _id: p._id }, { 'skillRequests.0.status': 'filled' });
    assert.equal((await api('get', '/api/users/me/skill-matches', 'member')).body.total, 0);
    await Project.updateOne({ _id: p._id }, { status: 'completed', 'skillRequests.0.status': 'open' });
    assert.equal((await api('get', '/api/users/me/skill-matches', 'member')).body.total, 0);
    assert.equal((await api('post', path).send(data)).status, 409);
  });
  test('concurrent first acceptances create one team, retries deduplicate and mirrors agree', async () => {
    const p = await project(), a = await apply(p), b = await Application.create({ userId: users.second._id, projectId: p._id, contributionType: 'time' });
    assert.equal(await Team.countDocuments(), 0);
    const responses = await Promise.all([accept(p, a), accept(p, b), accept(p, a)]);
    for (const r of responses) assert.equal(r.status, 200, r.text);
    assert.equal(await Team.countDocuments(), 1);
    const team = await Team.findOne(); assert.equal(team.members.length, 2);
    assert.equal(team.members.find(m => String(m.userId) === String(users.member._id)).role, 'Skill Contributor');
    assert.deepEqual((await Project.findById(p._id)).teamMembers.map(String).sort(), team.members.map(m => String(m.userId)).sort());
  });
  test('legacy backfill is idempotent and leaves zero-member and placeholder teams intact', async () => {
    const empty = await project(), old = await project({ teamMembers: [users.member._id, users.member._id] });
    const placeholder = await Team.create({ name: 'Old placeholder' });
    await prepareTeams(); await prepareTeams();
    assert.equal((await Project.findById(empty._id)).teamId, null);
    const restored = await Project.findById(old._id); assert.ok(restored.teamId); assert.equal(restored.teamMembers.length, 1);
    assert.equal(await Team.countDocuments(), 2); assert.ok(await Team.findById(placeholder._id));
  });
  test('acceptance rollback leaves application, project and team unchanged', async () => {
    const p = await project(), a = await apply(p);
    const original = Team.prototype.save;
    Team.prototype.save = async function () { throw new Error('Injected team write failure'); };
    try { assert.equal((await accept(p, a)).status, 500); } finally { Team.prototype.save = original; }
    assert.equal((await Application.findById(a._id)).status, 'pending'); assert.equal((await Project.findById(p._id)).teamMembers.length, 0); assert.equal(await Team.countDocuments(), 0);
  });
  test('all team routes deny unrelated users, NGOs, CSR and unauthenticated callers', async () => {
    const { id } = await formed(), bogus = new mongoose.Types.ObjectId();
    const paths = [['get', ''], ['get', '/messages'], ['post', '/messages'], ['post', '/tasks'], ['patch', `/tasks/${bogus}`], ['delete', `/tasks/${bogus}`], ['post', '/meetings'], ['patch', `/members/${users.member._id}`], ['delete', `/members/${users.member._id}`]];
    for (const [method, suffix] of paths) {
      const path = `/api/teams/${id}${suffix}`;
      assert.equal((await request(app)[method](path).send({})).status, 401);
      for (const who of ['outsider', 'otherngo', 'csr']) assert.equal((await api(method, path, who).send({})).status, 403, `${who} ${method} ${path}`);
    }
    const r = await api('get', `/api/teams/${id}`, 'member'); assert.equal(r.status, 200, r.text);
    assert.equal(r.body.team.members[0].user.email, undefined); assert.equal(r.body.team.members[0].user.passwordHash, undefined);
  });
  test('tasks support assign/edit/status/delete; role and meeting powers are constrained', async () => {
    const { id } = await formed(), path = `/api/teams/${id}`;
    assert.equal((await api('post', `${path}/tasks`, 'member').send({ title: 'Prepare lesson', assignedTo: users.member._id })).status, 200);
    let t = await Team.findById(id); const taskId = t.tasks[0]._id;
    assert.equal((await api('patch', `${path}/tasks/${taskId}`, 'member').send({ status: 'done', description: 'Ready', dueDate: '2026-10-01' })).status, 200);
    assert.equal((await api('patch', `${path}/tasks/${taskId}`, 'member').send({ assignedTo: users.outsider._id })).status, 400);
    assert.equal((await api('post', `${path}/meetings`, 'member').send({ title: 'Plan', dateTime: '2030-01-01' })).status, 403);
    assert.equal((await api('patch', `${path}/members/${users.member._id}`, 'member').send({ role: 'Coordinator' })).status, 403);
    assert.equal((await api('patch', `${path}/members/${users.member._id}`).send({ role: 'Coordinator' })).status, 200);
    assert.equal((await api('post', `${path}/meetings`, 'member').send({ title: 'Plan', dateTime: '2030-01-01' })).status, 200);
    assert.equal((await api('delete', `${path}/members/${users.member._id}`, 'member')).status, 403);
    t = await Team.findById(id); assert.equal(t.tasks[0].status, 'done'); assert.equal(t.tasks[0].description, 'Ready'); assert.equal(t.meetingSchedule.length, 1);
    assert.equal((await api('delete', `${path}/tasks/${taskId}`, 'member')).status, 200); assert.equal((await Team.findById(id)).tasks.length, 0);
  });
  test('removal mirrors membership, unassigns tasks, revokes every route and acceptance retry cannot re-add', async () => {
    const { p, a, id } = await formed();
    await api('post', `/api/teams/${id}/tasks`).send({ title: 'Assigned task', assignedTo: users.member._id });
    await api('post', `/api/teams/${id}/messages`, 'member').send({ content: 'Keep this history' });
    assert.equal((await api('delete', `/api/teams/${id}/members/${users.member._id}`)).status, 200);
    const t = await Team.findById(id); assert.equal(t.members.length, 0); assert.equal(t.tasks[0].assignedTo, null); assert.equal(t.messages.length, 1);
    assert.equal((await Project.findById(p._id)).teamMembers.length, 0);
    assert.equal((await accept(p, a)).status, 200); assert.equal((await Team.findById(id)).members.length, 0);
    assert.equal((await api('get', `/api/teams/${id}`, 'member')).status, 403);
    assert.equal((await api('post', `/api/teams/${id}/messages`, 'member').send({ content: 'Denied' })).status, 403);
    assert.equal((await api('get', '/api/users/me/applications', 'member')).body.applications[0].teamId, null);
  });
  test('message pagination handles identical timestamps without omissions and ignores forged sender', async () => {
    const { id } = await formed(); const timestamp = new Date('2026-01-01');
    await Team.updateOne({ _id: id }, { messages: Array.from({ length: 120 }, (_, i) => ({ senderId: users.member._id, content: `Message ${i}`, sentAt: timestamp })) });
    let cursor, ids = [];
    do { const r = await api('get', `/api/teams/${id}/messages${cursor ? '?before=' + encodeURIComponent(cursor) : ''}`, 'member'); assert.equal(r.status, 200, r.text); ids.push(...r.body.messages.map(m => m._id)); cursor = r.body.nextCursor; } while (cursor);
    assert.equal(ids.length, 120); assert.equal(new Set(ids).size, 120);
    const r = await api('get', `/api/teams/${id}`, 'member'); assert.equal(r.body.team.messages.length, 50); assert.ok(r.body.team.nextCursor);
    assert.equal((await api('post', `/api/teams/${id}/messages`, 'member').send({ content: 'New message', senderId: users.outsider._id, sentAt: '1900-01-01' })).status, 200);
    const latest = (await Team.findById(id)).messages.at(-1); assert.equal(String(latest.senderId), String(users.member._id)); assert.ok(latest.sentAt > timestamp);
    assert.equal((await api('get', `/api/teams/${id}/messages?before=invalid`, 'member')).status, 400);
  });
  test('concurrent messages/tasks and removal keep workspace and mirrored membership consistent', async () => {
    const { p, id } = await formed();
    const responses = await Promise.all(Array.from({ length: 8 }, (_, i) => api('post', `/api/teams/${id}/${i % 2 ? 'messages' : 'tasks'}`, 'member').send(i % 2 ? { content: `Concurrent ${i}` } : { title: `Task ${i}` })));
    for (const r of responses) assert.equal(r.status, 200, r.text);
    let t = await Team.findById(id); assert.equal(t.tasks.length, 4); assert.equal(t.messages.length, 4);
    const race = await Promise.all([api('delete', `/api/teams/${id}/members/${users.member._id}`), api('post', `/api/teams/${id}/tasks`, 'member').send({ title: 'Race task', assignedTo: users.member._id })]);
    assert.equal(race[0].status, 200); assert.ok([200, 403].includes(race[1].status));
    t = await Team.findById(id); assert.equal(t.members.length, 0); assert.ok(t.tasks.every(task => !task.assignedTo)); assert.equal((await Project.findById(p._id)).teamMembers.length, 0);
  });
  test('direct project application is visible to NGO and community with workspace links after acceptance', async () => {
    const p = await project();
    const r = await api('post', `/api/projects/${p._id}/apply`, 'member').send({ contributionType: 'time' }); assert.equal(r.status, 200, r.text);
    assert.equal((await api('post', `/api/projects/${p._id}/apply`, 'member').send({ contributionType: 'time' })).status, 409);
    const a = r.body.application; await accept(p, a);
    const mine = await api('get', '/api/users/me/applications', 'member'); assert.ok(mine.body.applications[0].teamId); assert.equal(mine.body.applications[0].project.title, p.title);
    const detail = await api('get', `/api/projects/${p._id}`, 'member'); assert.ok(detail.body.project.teamId); assert.equal(detail.body.project.teamMembers, undefined);
    assert.equal((await api('get', `/api/projects/${p._id}`, 'outsider')).body.project.teamId, null);
  });
  test('membership changes preserve CSR funding and update participation in reports', async () => {
    const { p, id } = await formed();
    const allocation = await api('post', `/api/csr/projects/${p._id}/fund`, 'csr').set('Idempotency-Key', 'team-funding-check').send({ amountAllocated: 200 });
    assert.equal(allocation.status, 201, allocation.text);
    let report = await api('get', `/api/csr/reports/${p._id}`, 'csr');
    assert.equal(report.body.report.volunteerParticipation, 1);
    await api('delete', `/api/teams/${id}/members/${users.member._id}`);
    report = await api('get', `/api/csr/reports/${p._id}`, 'csr');
    assert.equal(report.body.report.volunteerParticipation, 0);
    assert.equal(report.body.report.funding.allocated, 200);
    assert.equal((await Project.findById(p._id)).fundingReceived, 200);
    const summary = await api('get', '/api/csr/reports/portfolio', 'csr');
    assert.equal(summary.body.summary.volunteersInvolvedCount, 0);
    assert.equal(summary.body.summary.totalBudgetAllocated, 200);
  });
});
