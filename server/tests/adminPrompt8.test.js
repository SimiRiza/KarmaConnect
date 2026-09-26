import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../server.js';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import Project from '../models/Project.js';
import Contribution from '../models/Contribution.js';
import Funding from '../models/Funding.js';
import ImpactRecord from '../models/ImpactRecord.js';
import Report from '../models/Report.js';
import NGOProfile from '../models/NGOProfile.js';
import { generateAccessToken } from '../utils/tokenUtils.js';
import { createAdmin, adminCredentials } from '../services/adminService.js';
import { loginUser, refreshSession } from '../services/authService.js';
const password = 'TemporaryTest123!';
let admin, member, token;
const api = (method, url, t = token) => request(app)[method]('/api/admin' + url).set('Authorization', 'Bearer ' + t);
describe('Prompt 8 administration', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.USE_IN_MEMORY_DB = 'true';
    await connectDB();
    await User.init();
  });
  after(disconnectDB);
  test('bootstrap validates credentials and never promotes an existing user', async () => {
    assert.throws(() => adminCredentials({
      email: 'invalid',
      password
    }));
    assert.throws(() => adminCredentials({
      email: 'a@b.test',
      password: 'short'
    }));
    member = await User.create({
      name: 'Member',
      email: 'member@admin.test',
      passwordHash: 'unused',
      role: 'community_user'
    });
    await assert.rejects(createAdmin({
      email: member.email,
      password
    }, true), /already registered/);
    assert.equal((await User.findById(member._id)).role, 'community_user');
  });
  test('concurrent bootstrap creates exactly one admin and repeat is a no-op', async () => {
    const results = await Promise.all([createAdmin({
      email: 'one@admin.test',
      password
    }, true), createAdmin({
      email: 'two@admin.test',
      password
    }, true)]);
    assert.equal(results.filter(r => r.created).length, 1);
    assert.equal(await User.countDocuments({
      role: 'admin'
    }), 1);
    admin = await User.findOne({
      role: 'admin'
    });
    token = generateAccessToken(admin);
    assert.equal((await createAdmin({}, true)).created, false);
    assert.equal((await loginUser(admin.email, password)).user.isEmailVerified, true);
  });
  test('every added read API requires an admin', async () => {
    const paths = ['/stats/overview', '/stats/growth', '/categories', '/users', '/users/' + member.id, '/verifications', '/reports/' + member.id, '/projects/pending-verification', '/unknown'];
    for (const role of ['community_user', 'ngo', 'csr_manager']) {
      const u = await User.create({
        name: role,
        email: role + '@roles.test',
        passwordHash: 'unused',
        role
      });
      for (const path of paths) assert.equal((await api('get', path, generateAccessToken(u))).status, 403, path);
      assert.equal((await api('post', '/create-admin', generateAccessToken(u)).send({
        email: 'blocked@test.test',
        password
      })).status, 403);
    }
    for (const path of paths) assert.equal((await request(app).get('/api/admin' + path)).status, 401);
  });
  test('admin creation is private and safe user views never leak credentials', async () => {
    const r = await api('post', '/create-admin').send({
      name: 'Second Admin',
      email: 'second@admin.test',
      password
    });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.user.role, 'admin');
    assert.equal(r.body.user.passwordHash, undefined);
    const list = await api('get', '/users?search=second%40admin.test');
    assert.equal(list.body.total, 1);
    assert.equal((await api('get', '/users?search=%5B')).status, 200);
    const detail = await api('get', '/users/' + admin.id);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.user.passwordHash, undefined);
    assert.equal(detail.body.user.refreshTokens, undefined);
    const forged = await request(app).post('/api/auth/signup').send({
      name: 'Forged',
      email: 'forged@test.test',
      password,
      role: 'admin'
    });
    assert.equal(forged.status, 400);
  });
  test('suspension blocks passwords, access and refresh; reactivation requires a fresh session', async () => {
    const second = await User.findOne({
        email: 'second@admin.test'
      }),
      session = await loginUser(second.email, password);
    assert.equal((await api('patch', '/users/' + second.id + '/suspend').send({})).status, 200);
    assert.equal((await api('get', '/stats/overview', session.accessToken)).status, 403);
    await assert.rejects(loginUser(second.email, password), /suspended/);
    await assert.rejects(refreshSession(session.refreshToken), /suspended/);
    assert.equal((await api('patch', '/users/' + second.id + '/suspend').send({})).status, 200);
    assert.equal((await api('patch', '/users/' + second.id + '/reactivate').send({})).status, 200);
    await assert.rejects(refreshSession(session.refreshToken), /revoked/);
    await loginUser(second.email, password);
    assert.equal((await api('patch', '/users/' + admin.id + '/suspend').send({})).status, 409);
  });
  test('overview counts structured data once and excludes withdrawn/pending records', async () => {
    const p = await Project.create({
      ngoId: admin._id,
      title: 'Test project',
      description: 'Test impact',
      category: 'education',
      location: {
        city: 'Mumbai'
      },
      status: 'completed',
      fundingRequired: 80000,
      photos: {
        before: ['/before.jpg'],
        after: ['/after.jpg']
      }
    });
    await Funding.collection.insertMany([{
      projectId: p._id,
      idempotencyKey: 'first',
      status: 'allocated',
      amountAllocated: 100
    }, {
      projectId: p._id,
      idempotencyKey: 'second',
      status: 'withdrawn',
      amountAllocated: 900
    }]);
    await Contribution.collection.insertMany([{
      projectId: p._id,
      schemaVersion: 2,
      status: 'confirmed',
      type: 'money',
      moneyContributed: {
        amount: 25
      }
    }, {
      projectId: p._id,
      schemaVersion: 2,
      status: 'confirmed',
      type: 'time',
      timeContributed: {
        hours: 3
      }
    }, {
      projectId: p._id,
      schemaVersion: 2,
      status: 'confirmed',
      type: 'skills',
      skillsContributed: {
        hoursEquivalent: 2
      }
    }, {
      projectId: p._id,
      schemaVersion: 2,
      status: 'pending',
      timeContributed: {
        hours: 99
      }
    }]);
    await ImpactRecord.collection.insertOne({
      projectId: p._id,
      beneficiariesReached: 40
    });
    const r = await api('get', '/stats/overview');
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.totalFunding, 125);
    assert.equal(r.body.volunteerHours, 5);
    assert.equal(r.body.beneficiaries, 40);
    assert.equal(r.body.completedProjects, 1);
    const cats = await api('get', '/categories');
    assert.equal(cats.body.items.find(c => c.name === 'education').projects, 1);
    const queue = await api('get', '/projects/pending-verification');
    assert.equal(queue.body.items.length, 1);
  });
  test('growth fills twelve UTC periods and validates filters', async () => {
    for (const interval of ['week', 'month']) {
      const r = await api('get', '/stats/growth?interval=' + interval);
      assert.equal(r.status, 200, r.text);
      assert.equal(r.body.items.length, 12);
      assert.equal(r.body.items.reduce((n, p) => n + p.newUsers, 0), await User.countDocuments());
    }
    assert.equal((await api('get', '/stats/growth?interval=day')).status, 400);
    assert.equal((await api('get', '/users?role=invalid')).status, 400);
  });
  test('verification history requires review notes and report context hides user secrets', async () => {
    const profile = await NGOProfile.create({
      userId: member._id,
      ngoName: 'Test NGO',
      registrationNumber: 'TEST'
    });
    assert.equal((await api('patch', '/verifications/ngo/' + profile.id).send({
      verificationStatus: 'verified'
    })).status, 400);
    const review = await api('patch', '/verifications/ngo/' + profile.id).send({
      verificationStatus: 'verified',
      verificationNotes: 'Evidence checked'
    });
    assert.equal(review.status, 200, review.text);
    const history = await api('get', '/verifications?status=verified');
    assert.equal(history.body.items[0].verificationNotes, 'Evidence checked');
    const report = await Report.create({
      reportedBy: member._id,
      targetType: 'user',
      targetId: admin._id,
      reason: 'other',
      description: 'Review account'
    });
    const detail = await api('get', '/reports/' + report.id);
    assert.equal(detail.status, 200, detail.text);
    assert.equal(detail.body.target.passwordHash, undefined);
    assert.equal(detail.body.target.refreshTokens, undefined);
  });
  test('simultaneous administrators cannot suspend each other and leave no active admin', async () => {
    const second = await User.findOne({
      email: 'second@admin.test'
    });
    const results = await Promise.all([api('patch', '/users/' + second.id + '/suspend').send({}), api('patch', '/users/' + admin.id + '/suspend', generateAccessToken(second)).send({})]);
    assert.equal(results.filter(r => r.status === 200).length, 1);
    assert.equal(await User.countDocuments({
      role: 'admin',
      isSuspended: {
        $ne: true
      }
    }), 1);
  });
});
