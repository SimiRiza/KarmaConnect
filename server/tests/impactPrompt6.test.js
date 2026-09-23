import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server.js';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import Project from '../models/Project.js';
import Problem from '../models/Problem.js';
import Team from '../models/Team.js';
import Contribution from '../models/Contribution.js';
import Funding from '../models/Funding.js';
import ImpactRecord from '../models/ImpactRecord.js';
import NGOProfile from '../models/NGOProfile.js';
import CSRProfile from '../models/CSRProfile.js';
import { generateAccessToken } from '../utils/tokenUtils.js';
import { aggregateProjectFunding, aggregateProjectContributions, calculateProjectProgress, calculateUserImpact } from '../services/impactCalculations.js';
import { migrateContributionRecords, prepareImpact, migrationReport } from '../services/impactMigration.js';
const time = { type: 'time', timeContributed: { hours: 2.5, description: 'Tutored learners' } };
const skills = { type: 'skills', skillsContributed: { skills: ['Teaching', 'Design'], hoursEquivalent: 3, description: 'Created accessible lessons' } };
const cash = amount => ({ type: 'money', moneyContributed: { amount } });
const materials = { type: 'materials', materialsContributed: { items: [{ item: ' Books ', quantity: 3 }, { item: 'books', quantity: 2 }], estimatedValue: 100 } };
describe('Prompt 6 contributions, progress and impact', () => {
  const users = {}, tokens = {};
  const api = (method, path, who = 'member') => request(app)[method](path).set('Authorization', `Bearer ${tokens[who]}`);
  const give = (p, data, who = 'member', key = randomUUID()) => api('post', `/api/projects/${p._id}/contributions`, who).set('Idempotency-Key', key).send(data);
  const fund = (p, amount) => api('post', `/api/csr/projects/${p._id}/fund`, 'csr').set('Idempotency-Key', randomUUID()).send({ amountAllocated: amount });
  const review = (p, c, status = 'confirmed', extra = {}, who = 'ngo') => api('patch', `/api/projects/${p._id}/contributions/${c._id}/confirm`, who).send({ status, ...extra });
  const summary = p => api('get', `/api/projects/${p._id}/progress-summary`);
  const project = async (extra = {}) => {
    const p = await Project.create({ ngoId: users.ngo._id, title: 'Learning together', description: 'Restore the local classroom', category: 'education', location: { city: 'Pune' }, fundingRequired: 1000, status: 'in_progress', beneficiaries: { estimatedCount: 20 }, photos: { before: ['/uploads/before.jpg'], after: ['/uploads/after.jpg'] }, milestones: [{ title: 'Prepare', completed: true }, { title: 'Deliver', completed: false }], outcomesSummary: 'Twenty learners have a restored classroom.', ...extra });
    const team = await Team.create({ projectId: p._id, members: [{ userId: users.member._id, role: 'Volunteer' }] });
    await Project.updateOne({ _id: p._id }, { teamId: team._id, teamMembers: [users.member._id] }); return p;
  };
  before(async () => {
    process.env.NODE_ENV = 'test'; process.env.USE_IN_MEMORY_DB = 'true'; process.env.REQUIRE_EMAIL_VERIFICATION = 'false'; await connectDB();
    for (const [name, role] of [['ngo', 'ngo'], ['otherngo', 'ngo'], ['member', 'community_user'], ['donor', 'community_user'], ['outsider', 'community_user'], ['csr', 'csr_manager'], ['admin', 'admin']]) {
      users[name] = await User.create({ name, role, email: `${name}@impact.test`, passwordHash: 'test-only' }); tokens[name] = generateAccessToken(users[name]);
    }
    await NGOProfile.create({ userId: users.ngo._id, ngoName: 'Learning NGO', registrationNumber: 'IMPACT-TEST', verificationStatus: 'verified' });
    await CSRProfile.create({ userId: users.csr._id, companyName: 'Learning Company', csrManagerName: 'Manager' });
    await Promise.all([Contribution.init(), ImpactRecord.init(), Project.init(), Team.init(), Funding.init()]);
  });
  beforeEach(async () => { await Promise.all([Contribution.deleteMany({}), ImpactRecord.deleteMany({}), Project.deleteMany({}), Problem.deleteMany({}), Team.deleteMany({}), Funding.deleteMany({})]); });
  after(disconnectDB);
  test('all four payloads persist, pending materials do not count, and confirmed sums are exact', async () => {
    const p = await project();
    for (const data of [time, skills, cash(200.25)]) assert.equal((await give(p, data)).status, 200);
    const r = await give(p, materials); assert.equal(r.status, 200, r.text); assert.equal(r.body.contribution.status, 'pending');
    let totals = await aggregateProjectContributions(p._id); assert.equal(totals.totalHours, 5.5); assert.equal(totals.money, 200.25); assert.equal(totals.materials.length, 0);
    assert.equal((await review(p, r.body.contribution)).status, 200);
    totals = await aggregateProjectContributions(p._id); assert.deepEqual(totals.materials, [{ item: 'books', quantity: 5 }]); assert.equal(totals.materialEstimatedValue, 100); assert.equal(totals.money, 200.25);
    assert.equal(totals.skills.reduce((n, s) => n + s.hours, 0), 3);
    const stored = await Contribution.findOne({ type: 'time' }).lean(); assert.equal(stored.moneyContributed, undefined); assert.equal(stored.timeContributed.hours, 2.5);
  });
  test('invalid and forged payloads reject without changing totals', async () => {
    const p = await project();
    for (const data of [{ ...time, moneyContributed: { amount: 10 } }, { type: 'time' }, cash(-1), cash(0.001), { ...time, userId: users.donor._id }, { ...time, status: 'confirmed' }, { type: 'materials', materialsContributed: { items: [] } }, { type: 'skills', skillsContributed: { skills: [], hoursEquivalent: 1, description: 'No skills' } }]) assert.equal((await give(p, data)).status, 400);
    assert.equal((await api('post', `/api/projects/${p._id}/contributions`).send(cash(10))).status, 400);
    assert.equal(await Contribution.countDocuments(), 0);
  });
  test('idempotency handles concurrent retries and detects changed payloads', async () => {
    const p = await project(), key = randomUUID(); const responses = await Promise.all([give(p, cash(100), 'donor', key), give(p, cash(100), 'donor', key)]);
    for (const r of responses) assert.equal(r.status, 200, r.text);
    assert.equal(responses[0].body.contribution._id, responses[1].body.contribution._id); assert.equal(await Contribution.countDocuments(), 1);
    assert.equal((await give(p, cash(101), 'donor', key)).status, 409); assert.equal((await aggregateProjectFunding(p._id)).total, 100);
  });
  test('unified money separates CSR/volunteers and spending uses CSR first without double counting', async () => {
    const p = await project(); await give(p, cash(200)); const allocation = await fund(p, 300); assert.equal(allocation.status, 201);
    assert.deepEqual(await aggregateProjectFunding(p._id), { fromVolunteers: 200, fromCSR: 300, total: 500 });
    await api('patch', `/api/ngo/projects/${p._id}/resources`, 'ngo').send({ fundingSpent: 400, receiptNote: 'Cumulative receipt total' });
    const stored = await Project.findById(p._id); assert.equal(stored.fundingReceived, 500); assert.equal(stored.volunteerFundingSpent, 100); assert.equal(stored.unattributedSpent, 0);
    assert.equal((await Funding.findById(allocation.body.funding._id)).amountSpentSoFar, 300);
    await api('patch', `/api/ngo/projects/${p._id}/resources`, 'ngo').send({ fundingSpent: 550, receiptNote: 'Additional expense' });
    const r = await summary(p); assert.equal(r.body.funding.spent, 550); assert.equal(r.body.funding.unattributedSpent, 50); assert.equal(r.body.funding.remaining, 0);
    assert.equal((await CSRProfile.findOne({ userId: users.csr._id })).totalBudgetAllocated, 300);
  });
  test('CSR withdrawal retains volunteer pool; concurrent money requests cannot overfund', async () => {
    const p = await project({ status: 'adopted', fundingRequired: 300 }); await give(p, cash(100)); const f = await fund(p, 100);
    assert.equal((await api('patch', `/api/csr/fundings/${f.body.funding._id}/withdraw`, 'csr')).status, 200);
    assert.equal((await Project.findById(p._id)).fundingReceived, 100);
    const race = await Promise.all([give(p, cash(150)), fund(p, 150)]);
    assert.equal(race.filter(r => r.status < 300).length, 1); assert.equal(race.filter(r => r.status === 409).length, 1);
    assert.equal((await aggregateProjectFunding(p._id)).total, 250);
  });
  test('list privacy, membership for hours, and role restrictions are enforced', async () => {
    const p = await project(); await give(p, cash(10), 'donor');
    assert.equal((await give(p, time, 'donor')).status, 403);
    for (const who of ['donor', 'outsider', 'otherngo', 'csr', 'admin']) assert.equal((await api('get', `/api/projects/${p._id}/contributions`, who)).status, 403);
    for (const who of ['ngo', 'member']) { const r = await api('get', `/api/projects/${p._id}/contributions`, who); assert.equal(r.status, 200); assert.equal(r.body.items[0].userId.email, undefined); assert.equal(r.body.items[0].idempotencyKey, undefined); }
    for (const who of ['ngo', 'csr', 'admin']) assert.equal((await give(p, cash(10), who)).status, 403);
    for (const path of [`/api/projects/${p._id}/progress-summary`, `/api/projects/${p._id}/impact-record`, '/api/impact-records']) assert.equal((await request(app).get(path)).status, 401);
    const results = await Promise.all(['member', 'ngo', 'csr'].map(who => api('get', `/api/projects/${p._id}/progress-summary`, who)));
    assert.deepEqual(results[0].body, results[1].body); assert.deepEqual(results[1].body, results[2].body); assert.equal(JSON.stringify(results[0].body).includes(String(users.donor._id)), false);
  });
  test('pending review is NGO-owned, idempotent, and does not count rejected materials', async () => {
    const p = await project(), c = (await give(p, materials)).body.contribution;
    assert.equal((await review(p, c, 'confirmed', {}, 'otherngo')).status, 403);
    assert.equal((await review(p, c, 'confirmed', {}, 'member')).status, 403);
    assert.equal((await review(p, c, 'rejected')).status, 200); assert.equal((await review(p, c, 'rejected')).status, 200); assert.equal((await review(p, c, 'confirmed')).status, 409);
    assert.equal((await aggregateProjectContributions(p._id)).materials.length, 0);
  });
  test('progress recalculates for checked and unchecked milestones and empty lists', async () => {
    const p = await project(); assert.equal(await calculateProjectProgress(p._id), 50);
    for (const [milestones, expected] of [[[{ title: 'One', completed: true }, { title: 'Two', completed: true }], 100], [[{ title: 'One', completed: false }], 0], [[], 0]]) {
      const r = await api('put', `/api/ngo/projects/${p._id}`, 'ngo').send({ milestones }); assert.equal(r.status, 200, r.text);
      assert.equal((await Project.findById(p._id)).progressPercentage, expected); assert.equal((await summary(p)).body.progressPercentage, expected);
    }
  });
  test('completion creates one stable snapshot, updates existing stats, and ignores later team/photo/beneficiary edits', async () => {
    const p = await project(); await give(p, time); await give(p, skills); await give(p, cash(100)); await fund(p, 200);
    const pending = (await give(p, materials)).body.contribution;
    const path = `/api/ngo/projects/${p._id}/complete`;
    for (const r of await Promise.all([api('patch', path, 'ngo').send({}), api('patch', path, 'ngo').send({})])) assert.equal(r.status, 200, r.text);
    assert.equal(await ImpactRecord.countDocuments({ projectId: p._id }), 1);
    const original = (await ImpactRecord.findOne({ projectId: p._id }).lean());
    assert.equal(original.fundingRequired, 1000); assert.equal(original.totalVolunteerHours, 5.5); assert.equal(original.totalMoneyRaised, 300); assert.equal(original.volunteersInvolvedCount, 1); assert.ok(original.completedAt); assert.equal(original.reconstructed, false);
    assert.equal((await NGOProfile.findOne({ userId: users.ngo._id })).totalVolunteerHours, 5.5);
    const team = await Team.findOne({ projectId: p._id }); await api('delete', `/api/teams/${team._id}/members/${users.member._id}`, 'ngo');
    assert.equal((await review(p, pending)).status, 200);
    await api('put', `/api/ngo/projects/${p._id}`, 'ngo').send({ beneficiaries: { estimatedCount: 40 }, outcomesSummary: 'Edited later' });
    await api('post', `/api/ngo/projects/${p._id}/photos`, 'ngo').send({ category: 'after', urls: ['/uploads/later.jpg'] });
    assert.deepEqual(await ImpactRecord.findOne({ projectId: p._id }).lean(), original);
    assert.equal((await summary(p)).body.contributions.materials[0].quantity, 5);
    assert.equal((await give(p, cash(1))).status, 409);
  });
  test('all completion routes snapshot; failed snapshot rolls back completion and profile writes', async () => {
    for (const method of ['status', 'put']) {
      const p = await project(); const r = method === 'status' ? await api('patch', `/api/ngo/projects/${p._id}/status`, 'ngo').send({ status: 'completed' }) : await api('put', `/api/ngo/projects/${p._id}`, 'ngo').send({ status: 'completed' });
      assert.equal(r.status, 200, r.text); assert.ok(await ImpactRecord.exists({ projectId: p._id }));
    }
    const p = await project(), original = ImpactRecord.create;
    ImpactRecord.create = async () => { throw new Error('Injected snapshot failure'); };
    try { assert.equal((await api('patch', `/api/ngo/projects/${p._id}/complete`, 'ngo').send({})).status, 500); } finally { ImpactRecord.create = original; }
    assert.equal((await Project.findById(p._id)).status, 'in_progress'); assert.equal(await ImpactRecord.countDocuments({ projectId: p._id }), 0);
  });
  test('personal totals match confirmed records across projects without doubling skill hours', async () => {
    const a = await project(), b = await project(); await give(a, time); await give(a, skills); await give(a, cash(20.10)); await give(b, time); await give(b, cash(30.20)); await give(b, materials); await give(b, cash(10), 'donor');
    await api('patch', `/api/ngo/projects/${a._id}/complete`, 'ngo').send({});
    const impact = await calculateUserImpact(users.member._id, { limit: 2 });
    assert.equal(impact.totalVolunteerHours, 8); assert.equal(impact.totalMoneyContributed, 50.3); assert.equal(impact.completedProjectsCount, 1); assert.equal(impact.problemsParticipatedIn.count, 2); assert.equal(impact.materials.length, 0); assert.equal(impact.timeline.length, 2); assert.equal(impact.total, 6);
  });
  test('legacy migration retains original fields/dates, requires currency review and links later adoption', async () => {
    const problem = await Problem.create({ postedBy: users.member._id, title: 'Legacy problem', description: 'Help', category: 'education', location: { city: 'Pune' }, urgency: 'high' });
    const when = new Date('2020-01-01'); const legacy = await Contribution.collection.insertOne({ userId: users.member._id, problemId: problem._id, type: 'money', amount: 150, note: 'Old gift', createdAt: when, updatedAt: when });
    await migrateContributionRecords(); await migrateContributionRecords();
    let c = await Contribution.findById(legacy.insertedId).lean(); assert.equal(c.projectId, null); assert.equal(c.status, 'pending'); assert.equal(+c.createdAt, +when); assert.equal(+c.updatedAt, +when); assert.equal(c.amount, 150);
    assert.equal((await migrationReport()).awaitingProject, 1);
    const adoption = await api('post', `/api/ngo/problems/${problem._id}/adopt`, 'ngo').send({ fundingRequired: 100 }); assert.equal(adoption.status, 201, adoption.text);
    c = await Contribution.findById(c._id).lean(); const p = await Project.findById(c.projectId); assert.ok(p);
    assert.equal((await review(p, c, 'confirmed', cash(150))).status, 400);
    assert.equal((await review(p, c, 'confirmed', { ...cash(150), currency: 'INR' })).status, 200);
    assert.equal((await aggregateProjectFunding(p._id)).total, 150); assert.equal((await summary(p)).body.funding.excess, 50);
    await migrateContributionRecords(); assert.equal((await Contribution.findById(c._id)).status, 'confirmed'); assert.equal((await give(p, cash(1))).status, 409);
  });
  test('historical completion backfill is explicit, stable, and does not invent volunteer hours', async () => {
    const p = await project({ status: 'completed', volunteerHours: 75 });
    await Contribution.collection.insertOne({ userId: users.member._id, projectId: p._id, type: 'time', note: 'Old unmeasured help', createdAt: new Date(), updatedAt: new Date() });
    await prepareImpact(); const record = await ImpactRecord.findOne({ projectId: p._id }).lean();
    assert.equal(record.reconstructed, true); assert.equal(record.completedAt, null); assert.equal(record.totalVolunteerHours, 0); assert.equal(record.volunteersInvolvedCount, 1);
    await prepareImpact(); assert.deepEqual(await ImpactRecord.findById(record._id).lean(), record);
    const c = await Contribution.findOne({ projectId: p._id }); assert.equal(c.status, 'pending'); assert.equal(c.timeContributed, undefined);
    assert.equal((await Project.findById(p._id)).volunteerHours, 75);
  });
  test('impact stories filter completed snapshots and expose organization credits, not individual donations', async () => {
    const p = await project(); await give(p, cash(100)); await fund(p, 200);
    assert.equal((await api('get', `/api/projects/${p._id}/impact-record`)).status, 404);
    await api('patch', `/api/ngo/projects/${p._id}/complete`, 'ngo').send({}); await project();
    const r = await api('get', '/api/impact-records?category=education&location=pune&limit=1', 'csr'); assert.equal(r.status, 200); assert.equal(r.body.total, 1); assert.equal(r.body.items[0].csrCredits[0].companyName, 'Learning Company');
    assert.equal(JSON.stringify(r.body).includes(String(users.member._id)), false);
    assert.equal((await api('get', '/api/impact-records?location=Delhi')).body.total, 0);
    assert.equal((await api('get', '/api/impact-records?page=invalid')).status, 400);
  });
});
