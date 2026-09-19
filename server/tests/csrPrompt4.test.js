import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import app from '../server.js';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import NGOProfile from '../models/NGOProfile.js';
import CSRProfile from '../models/CSRProfile.js';
import Project from '../models/Project.js';
import Problem from '../models/Problem.js';
import Funding from '../models/Funding.js';
import { generateAccessToken } from '../utils/tokenUtils.js';
const baseProject = {
  title: 'School restoration',
  description: 'Improve a local school',
  problemStatement: 'Classrooms need repairs',
  category: 'education',
  location: {
    city: 'Pune',
    area: 'Central'
  },
  beneficiaries: {
    estimatedCount: 40,
    description: 'Students'
  },
  fundingRequired: 1000,
  timeline: {
    startDate: '2026-01-01',
    expectedEndDate: '2026-03-01'
  },
  milestones: [{
    title: 'Survey',
    completed: true,
    targetDate: '2026-01-05'
  }, {
    title: 'Repair',
    completed: false,
    targetDate: '2026-02-01'
  }]
};
describe('Prompt 4 CSR funding, monitoring and reports', () => {
  let users = {},
    tokens = {};
  const api = (method, path, who = 'csr1') => request(app)[method](path).set('Authorization', `Bearer ${tokens[who]}`);
  const csr = (method, path, who) => api(method, '/api/csr' + path, who);
  const project = (extra = {}) => Project.create({
    ...baseProject,
    ngoId: users.ngo._id,
    ...extra
  });
  const fund = (id, amount = 100, who = 'csr1', key = randomUUID(), notes = '') => csr('post', `/projects/${id}/fund`, who).set('Idempotency-Key', key).send({
    amountAllocated: amount,
    notes
  });
  const spend = (id, amount) => api('patch', `/api/ngo/projects/${id}/resources`, 'ngo').send({
    fundingSpent: amount,
    receiptNote: 'Receipt: verified project expense'
  });
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.USE_IN_MEMORY_DB = 'true';
    process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
    await connectDB();
    for (const [name, role] of [['csr1', 'csr_manager'], ['csr2', 'csr_manager'], ['ngo', 'ngo'], ['ngo2', 'ngo'], ['community', 'community_user'], ['admin', 'admin']]) {
      users[name] = await User.create({
        name,
        email: `${name}@csr-test.org`,
        role,
        passwordHash: 'test-only',
        location: {
          city: 'Pune'
        }
      });
      tokens[name] = generateAccessToken(users[name]);
    }
    await NGOProfile.create([{
      userId: users.ngo._id,
      ngoName: 'Verified NGO',
      registrationNumber: 'CSR-TEST1',
      verificationStatus: 'verified',
      previousProjectsCount: 3,
      totalBeneficiariesReached: 120
    }, {
      userId: users.ngo2._id,
      ngoName: 'Pending NGO',
      registrationNumber: 'CSR-TEST2',
      verificationStatus: 'pending'
    }]);
    await CSRProfile.create(['csr1', 'csr2'].map(key => ({
      userId: users[key]._id,
      companyName: key,
      csrManagerName: key,
      csrFocusAreas: ['Education & Literacy'],
      budgetRange: 'INR 0-10000'
    })));
    await Funding.init();
    await Project.init();
  });
  beforeEach(async () => {
    // Isolated in-memory replica set created above; no application database touched.
    await Funding.deleteMany({});
    await Project.deleteMany({});
    await Problem.deleteMany({});
    await CSRProfile.updateMany({}, {
      $set: {
        csrFocusAreas: ['Education & Literacy'],
        budgetRange: 'INR 0-10000',
        totalBudgetAllocated: 0,
        totalAmountSpent: 0,
        activeProjectsCount: 0,
        completedProjectsCount: 0,
        totalBeneficiariesReached: 0,
        totalNgosPartnered: 0
      }
    });
  });
  after(disconnectDB);
  test('every CSR endpoint enforces authentication and the exact CSR role', async () => {
    const id = new mongoose.Types.ObjectId();
    const routes = [['get', '/me/profile'], ['put', '/me/profile'], ['get', '/projects'], ['get', `/projects/${id}`], ['post', '/match-projects'], ['post', `/projects/${id}/fund`], ['get', '/fundings'], ['get', `/fundings/${id}`], ['patch', `/fundings/${id}/withdraw`], ['get', `/projects/${id}/progress`], ['get', `/reports/${id}`], ['get', '/reports/portfolio'], ['get', '/dashboard-summary']];
    for (const [method, route] of routes) {
      assert.equal((await request(app)[method]('/api/csr' + route).send({})).status, 401);
      for (const who of ['ngo', 'community', 'admin']) assert.equal((await csr(method, route, who).send({})).status, 403, `${method} ${route} ${who}`);
    }
    const p = await project();
    for (const [method, path] of [['post', '/api/ngo/projects'], ['put', `/api/ngo/projects/${p._id}`], ['patch', `/api/ngo/projects/${p._id}/status`], ['post', `/api/ngo/problems/${p._id}/adopt`], ['post', '/api/problems'], ['patch', `/api/ngo/projects/${p._id}/resources`]]) assert.equal((await api(method, path).send(baseProject)).status, 403);
    assert.equal((await csr('put', `/projects/${p._id}`).send({
      title: 'Hijacked'
    })).status, 404);
  });
  test('profile editable fields persist while verification and stats stay server-owned', async () => {
    const r = await csr('put', '/me/profile').send({
      companyName: 'New company',
      industry: 'Technology',
      csrFocusAreas: ['education', 'environment'],
      budgetRange: '$10,000 - $50,000 / year',
      companyWebsite: 'https://example.org',
      csrManagerName: 'Manager',
      verificationStatus: 'verified',
      totalBudgetAllocated: 999
    });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.profile.companyName, 'New company');
    assert.equal(r.body.profile.verificationStatus, 'pending');
    assert.equal(r.body.profile.totalBudgetAllocated, 0);
    assert.equal(r.body.user.passwordHash, undefined);
    assert.equal((await csr('put', '/me/profile').send({
      companyWebsite: 'javascript:bad'
    })).status, 400);
    assert.equal((await csr('put', '/me/profile').send({
      csrFocusAreas: ['imaginary category']
    })).status, 400);
    const dash = await csr('get', '/dashboard-summary');
    assert.equal(dash.status, 200, dash.text);
    assert.match(dash.body.summary.recommendationNote, /Set an INR budget/);
  });
  test('discovery and temporary matching filter three categories and NGO credibility correctly', async () => {
    const source = await Problem.create({
      postedBy: users.community._id,
      title: 'School problem',
      description: 'Needs help',
      category: 'education',
      urgency: 'high',
      location: {
        city: 'Pune'
      }
    });
    const education = await project({
      sourceProblemId: source._id
    });
    await project({
      title: 'Trees',
      category: 'environment',
      fundingRequired: 2000
    });
    await project({
      title: 'Health camp',
      category: 'health',
      location: {
        city: 'Mumbai'
      },
      ngoId: users.ngo2._id
    });
    const full = await project({
      title: 'Fully funded',
      fundingRequired: 50
    });
    await fund(full._id, 50);
    const r = await csr('get', '/projects?category=education&location=Pune&fundingMin=500&fundingMax=1500&verificationStatus=verified&beneficiariesMin=30&beneficiariesMax=50&urgency=high&timelineMonths=3');
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.total, 1);
    assert.equal(r.body.items[0]._id, String(education._id));
    assert.equal(r.body.items[0].ngo.verificationStatus, 'verified');
    assert.equal(r.body.items[0].location.coordinates, undefined);
    assert.equal((await csr('get', '/projects')).body.total, 3);
    assert.equal((await csr('get', '/projects?includeFullyFunded=true')).body.total, 4);
    const matches = await csr('post', '/match-projects').send({
      focusAreas: ['Education & Literacy'],
      location: 'Pune',
      budgetMin: 500,
      budgetMax: 1500,
      timelineMonths: 3
    });
    assert.equal(matches.status, 200, matches.text);
    assert.deepEqual(matches.body.items.map(p => p._id), [String(education._id)]);
    assert.equal(matches.body.items[0].overlapCount, 1);
    assert.equal((await csr('post', '/match-projects').send({
      focusAreas: ['health'],
      location: 'Pune'
    })).body.total, 0);
    assert.equal((await csr('get', '/projects?fundingMin=200&fundingMax=100')).status, 400);
    assert.equal((await csr('get', '/projects?timelineMonths=invalid')).status, 400);
    const detail = await csr('get', `/projects/${education._id}`);
    assert.equal(detail.body.project.ngo.previousProjectsCount, 3);
    assert.equal(detail.body.project.ngo.totalBeneficiariesReached, 120);
    assert.equal(detail.body.project.teamMembers, undefined);
  });
  test('two CSR accounts sum allocations, spending follows oldest-first and corrections reconcile', async () => {
    const p = await project();
    const a = await fund(p._id, 100);
    const b = await fund(p._id, 200, 'csr2');
    assert.equal(a.status, 201, a.text);
    assert.equal(b.status, 201, b.text);
    let stored = await Project.findById(p._id);
    assert.equal(stored.fundingReceived, 300);
    assert.equal(stored.fundedBy.length, 2);
    assert.equal((await spend(p._id, 150)).status, 200);
    assert.equal((await Funding.findById(a.body.funding._id)).amountSpentSoFar, 100);
    assert.equal((await Funding.findById(b.body.funding._id)).amountSpentSoFar, 50);
    assert.equal((await CSRProfile.findOne({
      userId: users.csr1._id
    })).totalAmountSpent, 100);
    assert.equal((await CSRProfile.findOne({
      userId: users.csr2._id
    })).totalAmountSpent, 50);
    await spend(p._id, 80);
    assert.equal((await Funding.findById(a.body.funding._id)).amountSpentSoFar, 80);
    assert.equal((await Funding.findById(b.body.funding._id)).amountSpentSoFar, 0);
    stored = await Project.findById(p._id);
    assert.equal(stored.fundingSpent, 80);
    assert.equal(stored.resourceUpdates.length, 2); // not 150+80
  });
  test('legacy spending remains intact and later allocations cover it without fake spending', async () => {
    const p = await project({
      fundingSpent: 150
    });
    const a = await fund(p._id, 100);
    assert.equal(a.status, 201, a.text);
    assert.equal(a.body.funding.amountSpentSoFar, 100);
    let d = await csr('get', `/projects/${p._id}`);
    assert.equal(d.body.project.fundingSpent, 150);
    assert.equal(d.body.project.unattributedSpent, 50);
    const b = await fund(p._id, 100, 'csr2');
    assert.equal(b.body.funding.amountSpentSoFar, 50);
    d = await csr('get', `/projects/${p._id}`);
    assert.equal(d.body.project.unattributedSpent, 0);
    assert.equal(d.body.project.fundingSpent, 150);
  });
  test('idempotency protects retries and rejects changed payloads', async () => {
    const p = await project();
    const key = randomUUID();
    const results = await Promise.all([fund(p._id, 100, 'csr1', key), fund(p._id, 100, 'csr1', key)]);
    assert.deepEqual(results.map(r => r.status), [201, 201]);
    assert.equal(results[0].body.funding._id, results[1].body.funding._id);
    assert.equal(await Funding.countDocuments(), 1);
    assert.equal((await fund(p._id, 101, 'csr1', key)).status, 409);
    assert.equal((await Project.findById(p._id)).fundingReceived, 100);
  });
  test('concurrent funders cannot exceed the funding gap', async () => {
    const p = await project({
      fundingRequired: 100
    });
    const results = await Promise.all([fund(p._id, 80), fund(p._id, 80, 'csr2')]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    assert.equal((await Project.findById(p._id)).fundingReceived, 80);
    assert.equal(await Funding.countDocuments(), 1);
  });
  test('simultaneous funding of different projects preserves company totals', async () => {
    const a = await project(),
      b = await project();
    const results = await Promise.all([fund(a._id, 100), fund(b._id, 200)]);
    assert.deepEqual(results.map(r => r.status), [201, 201]);
    const profile = await CSRProfile.findOne({
      userId: users.csr1._id
    });
    assert.equal(profile.totalBudgetAllocated, 300);
    assert.equal(profile.activeProjectsCount, 2);
  });
  test('a failed reconciliation rolls back Funding, Project and profile together', async () => {
    const p = await project();
    const original = Project.prototype.save;
    Project.prototype.save = async function (options) {
      if (this.fundedBy.length) throw Object.assign(new Error('Injected reconciliation failure'), {
        statusCode: 503
      });
      return original.call(this, options);
    };
    try {
      assert.equal((await fund(p._id)).status, 503);
    } finally {
      Project.prototype.save = original;
    }
    assert.equal(await Funding.countDocuments(), 0);
    assert.equal((await Project.findById(p._id)).fundingReceived, 0);
    assert.equal((await CSRProfile.findOne({
      userId: users.csr1._id
    })).totalBudgetAllocated, 0);
  });
  test('withdrawal removes only eligible allocations and preserves history and ownership', async () => {
    const p = await project();
    const a = await fund(p._id, 100),
      b = await fund(p._id, 200, 'csr2');
    assert.equal((await csr('patch', `/fundings/${a.body.funding._id}/withdraw`, 'csr2')).status, 403);
    assert.equal((await csr('get', `/fundings/${a.body.funding._id}`, 'csr2')).status, 403);
    assert.equal((await csr('patch', `/fundings/${a.body.funding._id}/withdraw`)).status, 200);
    assert.equal((await csr('patch', `/fundings/${a.body.funding._id}/withdraw`)).status, 200);
    const stored = await Project.findById(p._id);
    assert.equal(stored.fundingReceived, 200);
    assert.deepEqual(stored.fundedBy.map(String), [String(users.csr2._id)]);
    assert.equal((await csr('get', '/fundings?status=withdrawn')).body.fundings.length, 1);
    assert.equal((await csr('get', '/reports/portfolio')).body.summary.totalBudgetAllocated, 0);
    assert.equal((await csr('get', `/projects/${p._id}/progress`)).status, 403);
    assert.equal((await csr('get', `/reports/${p._id}`)).status, 403);
    await spend(p._id, 10);
    assert.equal((await csr('patch', `/fundings/${b.body.funding._id}/withdraw`, 'csr2')).status, 409);
  });
  test('withdrawal racing spending cannot remove attributed funds', async () => {
    const p = await project();
    const a = await fund(p._id, 100);
    const [withdrawn, spent] = await Promise.all([csr('patch', `/fundings/${a.body.funding._id}/withdraw`), spend(p._id, 50)]);
    assert.equal(spent.status, 200);
    assert.ok([200, 409].includes(withdrawn.status));
    const record = await Funding.findById(a.body.funding._id),
      stored = await Project.findById(p._id);
    assert.equal(stored.fundingSpent, 50);
    if (record.status === 'withdrawn') {
      assert.equal(record.amountSpentSoFar, 0);
      assert.equal(stored.fundingReceived, 0);
    } else {
      assert.equal(record.amountSpentSoFar, 50);
      assert.equal(stored.fundingReceived, 100);
    }
  });
  test('NGO project status and completion propagate to fundings, profiles and accurate reports', async () => {
    const p = await project({
      teamMembers: [users.community._id],
      photos: {
        before: ['https://example.org/before.png'],
        after: ['https://example.org/after.png']
      }
    });
    const a = await fund(p._id, 100);
    await fund(p._id, 200, 'csr2');
    await fund(p._id, 50);
    await spend(p._id, 150);
    for (const status of ['team_forming', 'funding_needed', 'in_progress']) assert.equal((await api('patch', `/api/ngo/projects/${p._id}/status`, 'ngo').send({
      status
    })).status, 200);
    assert.equal((await csr('patch', `/fundings/${a.body.funding._id}/withdraw`)).status, 409);
    assert.equal((await api('patch', `/api/ngo/projects/${p._id}/complete`, 'ngo').send({})).status, 200);
    assert.equal((await Funding.findById(a.body.funding._id)).status, 'completed');
    const r = await csr('get', `/reports/${p._id}`);
    assert.equal(r.status, 200, r.text);
    const report = r.body.report;
    assert.equal(report.funding.allocated, 150);
    assert.equal(report.funding.spent, 100);
    assert.equal(report.funding.remaining, 50);
    assert.equal(report.project.fundingReceived, 350);
    assert.equal(report.project.fundingSpent, 150);
    assert.equal(report.beneficiariesReached, 40);
    assert.equal(report.completedMilestones.length, 1);
    assert.equal(report.volunteerParticipation, 1);
    assert.equal(report.project.photos.after.length, 1);
    const profile = await CSRProfile.findOne({
      userId: users.csr1._id
    });
    assert.equal(profile.completedProjectsCount, 1);
    assert.equal(profile.totalBeneficiariesReached, 40);
    assert.equal((await fund(p._id, 1)).status, 409);
    await api('put', `/api/ngo/projects/${p._id}`, 'ngo').send({
      beneficiaries: {
        estimatedCount: 55
      }
    });
    assert.equal((await CSRProfile.findOne({
      userId: users.csr1._id
    })).totalBeneficiariesReached, 55);
  });
  test('portfolio aggregates distinct projects and NGOs instead of allocation records', async () => {
    const a = await project({
      status: 'in_progress',
      photos: {
        after: ['https://example.org/a.jpg']
      },
      teamMembers: [users.community._id]
    });
    const b = await project({
      ngoId: users.ngo2._id,
      category: 'health',
      beneficiaries: {
        estimatedCount: 90
      },
      teamMembers: [users.community._id]
    });
    await fund(a._id, 100);
    await fund(a._id, 200);
    await fund(b._id, 50);
    await spend(a._id, 80);
    await api('patch', `/api/ngo/projects/${a._id}/complete`, 'ngo').send({});
    const s = (await csr('get', '/reports/portfolio')).body.summary;
    assert.equal(s.totalBudgetAllocated, 350);
    assert.equal(s.totalAmountSpent, 80);
    assert.equal(s.remaining, 270);
    assert.equal(s.completedProjectsCount, 1);
    assert.equal(s.activeProjectsCount, 1);
    assert.equal(s.totalNgosPartnered, 2);
    assert.equal(s.totalBeneficiariesReached, 40);
    assert.equal(s.estimatedBeneficiaries, 90);
    assert.equal(s.volunteersInvolvedCount, 2);
    assert.equal(s.projects.length, 2);
    assert.equal(s.projectsByStatus.completed, 1);
    const dash = await csr('get', '/dashboard-summary');
    assert.equal(dash.status, 200, dash.text);
    assert.equal(dash.body.summary.totalBudgetAllocated, 350);
    assert.equal(dash.body.summary.recentActivity.length, 2);
    const empty = (await csr('get', '/reports/portfolio', 'csr2')).body.summary;
    assert.equal(empty.totalBudgetAllocated, 0);
    assert.deepEqual(empty.projects, []);
  });
  test('simultaneous funded completions preserve shared CSR statistics', async () => {
    const a = await project({
      status: 'in_progress',
      photos: {
        after: ['https://example.org/a.jpg']
      }
    });
    const b = await project({
      status: 'in_progress',
      photos: {
        after: ['https://example.org/b.jpg']
      }
    });
    const first = await fund(a._id, 100);
    await fund(b._id, 200);
    assert.equal(first.body.funding.status, 'in_progress');
    assert.equal((await csr('patch', '/fundings/' + first.body.funding._id + '/withdraw')).status, 409);
    const results = await Promise.all([api('patch', '/api/ngo/projects/' + a._id + '/complete', 'ngo').send({}), api('patch', '/api/ngo/projects/' + b._id + '/complete', 'ngo').send({})]);
    assert.deepEqual(results.map(r => r.status), [200, 200]);
    const profile = await CSRProfile.findOne({
      userId: users.csr1._id
    });
    assert.equal(profile.completedProjectsCount, 2);
    assert.equal(profile.activeProjectsCount, 0);
    assert.equal(profile.totalBeneficiariesReached, 80);
    assert.equal(profile.totalBudgetAllocated, 300);
    assert.equal(await Funding.countDocuments({
      status: 'completed'
    }), 2);
  });
  test('amount and input validation rejects unsafe precision and invalid identifiers', async () => {
    const p = await project();
    for (const amount of [-1, 0, 0.001, '100', null, 100000000001]) assert.equal((await fund(p._id, amount)).status, 400);
    assert.equal((await csr('post', `/projects/${p._id}/fund`).send({
      amountAllocated: 10
    })).status, 400);
    assert.equal((await csr('get', '/projects/bad-id')).status, 400);
    assert.equal((await csr('get', '/fundings?status=bad')).status, 400);
    const a = await fund(p._id, 0.1),
      b = await fund(p._id, 0.2, 'csr2');
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.equal((await Project.findById(p._id)).fundingReceived, 0.3);
  });
});
