import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import app from '../server.js';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import NGOProfile from '../models/NGOProfile.js';
import CommunityUserProfile from '../models/CommunityUserProfile.js';
import Project from '../models/Project.js';
import Problem from '../models/Problem.js';
import Application from '../models/Application.js';
import { generateAccessToken } from '../utils/tokenUtils.js';
import { adoptProblem } from '../services/ngoService.js';
import { prepareNgoIndexes } from '../utils/ngoIndexes.js';
import { strictTransaction } from '../utils/strictTransaction.js';
const payload = {
  title: 'Restore the park',
  description: 'Community park restoration',
  category: 'environment',
  location: {
    city: 'Pune',
    area: 'Central'
  },
  beneficiaries: {
    estimatedCount: 25,
    description: 'Local residents'
  },
  materialsNeeded: [{
    item: 'Plants',
    quantityNeeded: 10
  }],
  fundingRequired: 500,
  volunteersNeeded: 2,
  volunteerHours: 7.5
};
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
describe('Prompt 3 NGO workflow and regression', () => {
  let owner,
    other,
    volunteer,
    csr,
    admin,
    tokens = {},
    uploads = [];
  const api = (method, route, who = 'owner') => request(app)[method]('/api/ngo' + route).set('Authorization', `Bearer ${tokens[who]}`);
  const problem = (extra = {}) => Problem.create({
    postedBy: volunteer._id,
    title: 'Community park',
    description: 'Restore our park',
    category: 'environment',
    location: {
      city: 'Pune',
      area: 'Central'
    },
    urgency: 'high',
    photos: ['https://example.org/before.jpg'],
    estimatedResourcesNeeded: 'Plants and gardening tools',
    ...extra
  });
  const project = (extra = {}) => Project.create({
    ...payload,
    ngoId: owner._id,
    ...extra
  });
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.USE_IN_MEMORY_DB = 'true';
    process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
    await connectDB();
    const make = (name, role) => User.create({
      name,
      role,
      email: `${name.replaceAll(' ', '')}@ngo-test.org`,
      passwordHash: 'test-only-hash',
      location: {
        city: 'Pune'
      }
    });
    [owner, other, volunteer, csr, admin] = await Promise.all([make('Owner NGO', 'ngo'), make('Other NGO', 'ngo'), make('Volunteer One', 'community_user'), make('CSR One', 'csr_manager'), make('Admin One', 'admin')]);
    for (const [key, user] of Object.entries({
      owner,
      other,
      volunteer,
      csr,
      admin
    })) tokens[key] = generateAccessToken(user);
    await NGOProfile.create([{
      userId: owner._id,
      ngoName: owner.name,
      registrationNumber: 'TEST1',
      verificationStatus: 'verified'
    }, {
      userId: other._id,
      ngoName: other.name,
      registrationNumber: 'TEST2',
      verificationStatus: 'verified'
    }]);
    await CommunityUserProfile.create({
      userId: volunteer._id,
      subType: 'student',
      skills: ['Gardening'],
      availability: 'Weekends'
    });
    await Promise.all([Project.init(), Application.init()]);
  });
  beforeEach(async () => {
    // connectDB above starts a fresh isolated memory replica set for this suite.
    await Promise.all([Project.deleteMany({}), Problem.deleteMany({}), Application.deleteMany({}), NGOProfile.updateMany({}, {
      $set: {
        verificationStatus: 'verified',
        previousProjectsCount: 0,
        totalBeneficiariesReached: 0,
        totalVolunteerHours: 0
      }
    })]);
  });
  after(async () => {
    await Promise.all(uploads.map(file => fs.unlink(file).catch(() => {})));
    await disconnectDB();
  });
  test('all NGO routes enforce authentication and role separation', async () => {
    const p = await project();
    const routes = [['get', '/me/profile'], ['put', '/me/profile'], ['get', '/problems'], ['post', `/problems/${p._id}/adopt`], ['get', '/projects'], ['post', '/projects'], ['get', `/projects/${p._id}`], ['put', `/projects/${p._id}`], ['patch', `/projects/${p._id}/status`], ['get', `/projects/${p._id}/applicants`], ['patch', `/applications/${p._id}`], ['patch', `/projects/${p._id}/resources`], ['post', `/projects/${p._id}/photos`], ['patch', `/projects/${p._id}/complete`], ['get', '/dashboard-summary']];
    for (const [method, route] of routes) {
      assert.equal((await request(app)[method]('/api/ngo' + route).send({})).status, 401);
      for (const who of ['volunteer', 'csr', 'admin']) assert.equal((await api(method, route, who).send({})).status, 403, `${method} ${route} ${who}`);
    }
  });
  test('legacy application index is replaced without deleting existing records', async () => {
    const p = await problem();
    await Application.create({
      userId: volunteer._id,
      problemId: p._id,
      contributionType: 'time'
    });
    await Application.collection.createIndex({
      userId: 1,
      problemId: 1
    }, {
      name: 'userId_1_problemId_1',
      unique: true
    });
    await prepareNgoIndexes();
    assert.equal(await Application.countDocuments(), 1);
    assert.ok(!(await Application.collection.indexes()).some(i => i.name === 'userId_1_problemId_1'));
    const a = await project(),
      b = await project();
    await Application.create([{
      userId: volunteer._id,
      projectId: a._id,
      contributionType: 'time'
    }, {
      userId: volunteer._id,
      projectId: b._id,
      contributionType: 'time'
    }]);
    assert.equal(await Application.countDocuments(), 3);
  });
  test('profile is editable but verification and totals cannot be self-assigned', async () => {
    const r = await api('put', '/me/profile').send({
      about: 'Local action',
      causeAreas: ['Environment'],
      locationsServed: ['Pune'],
      photos: ['https://example.org/ngo.jpg'],
      team: [{
        name: 'Asha',
        role: 'Coordinator',
        photoUrl: 'https://example.org/asha.jpg'
      }],
      verificationStatus: 'rejected',
      totalVolunteerHours: 9999
    });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.profile.about, 'Local action');
    assert.equal(r.body.profile.verificationStatus, 'verified');
    assert.equal(r.body.profile.totalVolunteerHours, 0);
    assert.equal(r.body.user.passwordHash, undefined);
    assert.equal(r.body.user.refreshTokens, undefined);
    assert.equal((await api('put', '/me/profile').send({
      team: [{
        name: 'Asha'
      }]
    })).status, 400);
  });
  test('pending and rejected NGOs may browse but cannot create or adopt', async () => {
    const p = await problem();
    for (const state of ['pending', 'rejected']) {
      await NGOProfile.updateOne({
        userId: owner._id
      }, {
        verificationStatus: state
      });
      assert.equal((await api('get', '/problems')).status, 200);
      assert.equal((await api('get', '/dashboard-summary')).status, 200);
      assert.equal((await api('post', '/projects').send(payload)).status, 403);
      assert.equal((await api('post', `/problems/${p._id}/adopt`).send({})).status, 403);
    }
    assert.equal(await Project.countDocuments(), 0);
    assert.equal((await Problem.findById(p._id)).status, 'reported');
  });
  test('shared discovery applies resources, location and real urgency ordering before pagination', async () => {
    await problem({
      urgency: 'low'
    });
    const high = await problem();
    await problem({
      urgency: 'medium'
    });
    await problem({
      status: 'adopted'
    });
    await problem({
      location: {
        city: 'Mumbai'
      }
    });
    const r = await api('get', '/problems?location=Pune&category=environment&resources=plants&sort=most_urgent&limit=1');
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.total, 3);
    assert.equal(r.body.items[0]._id, String(high._id));
    assert.equal(r.body.items[0].location.coordinates, undefined);
    assert.equal((await api('get', '/problems?location=.*')).body.total, 0);
    assert.equal((await api('get', '/problems?page=nope&limit=nope')).status, 200);
  });
  test('concurrent adoption creates exactly one reciprocally linked project', async () => {
    const p = await problem();
    const results = await Promise.all([api('post', `/problems/${p._id}/adopt`).send({
      title: 'NGO park project'
    }), api('post', `/problems/${p._id}/adopt`, 'other').send({})]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    const linked = await Problem.findById(p._id),
      created = await Project.findOne({
        sourceProblemId: p._id
      });
    assert.equal(await Project.countDocuments({
      sourceProblemId: p._id
    }), 1);
    assert.equal(String(linked.linkedProjectId), String(created._id));
    assert.equal(String(linked.adoptedByNgoId), String(created.ngoId));
    assert.equal(linked.status, 'adopted');
    assert.deepEqual(created.photos.before, p.photos);
  });
  test('failure after project insertion rolls back both documents', async () => {
    const p = await problem();
    const original = Problem.prototype.save;
    Problem.prototype.save = async function (options) {
      if (this.linkedProjectId) throw new Error('Injected failure between writes');
      return original.call(this, options);
    };
    try {
      await assert.rejects(adoptProblem(owner._id, p._id), /Injected failure/);
    } finally {
      Problem.prototype.save = original;
    }
    assert.equal(await Project.countDocuments({
      sourceProblemId: p._id
    }), 0);
    const unchanged = await Problem.findById(p._id);
    assert.equal(unchanged.status, 'reported');
    assert.equal(unchanged.linkedProjectId, null);
    assert.equal(unchanged.adoptedByNgoId, null);
  });
  test('strict transaction never invokes a standalone fallback', async () => {
    const original = mongoose.startSession;
    let writes = 0,
      ended = false;
    mongoose.startSession = async () => ({
      withTransaction: async () => {
        throw Object.assign(new Error('Transaction numbers are only allowed on a replica set member'), {
          code: 20
        });
      },
      endSession: async () => {
        ended = true;
      }
    });
    try {
      await assert.rejects(strictTransaction(async () => {
        writes++;
      }), e => e.statusCode === 503);
    } finally {
      mongoose.startSession = original;
    }
    assert.equal(writes, 0);
    assert.equal(ended, true);
  });
  test('direct creation controls protected fields and rejects invalid input', async () => {
    const r = await api('post', '/projects').send({
      ...payload,
      ngoId: other._id,
      sourceProblemId: new mongoose.Types.ObjectId(),
      teamMembers: [volunteer._id],
      fundingReceived: 900,
      fundingSpent: 800
    });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.body.project.sourceProblemId, null);
    assert.equal(r.body.project.ngoId, String(owner._id));
    assert.equal(r.body.project.status, 'adopted');
    assert.equal(r.body.project.fundingReceived, 0);
    assert.equal(r.body.project.fundingSpent, 0);
    assert.deepEqual(r.body.project.teamMembers, []);
    for (const data of [{
      status: 'completed'
    }, {
      fundingRequired: -1
    }, {
      volunteersNeeded: 2.5
    }, {
      timeline: {
        startDate: '2027-02-01',
        expectedEndDate: '2027-01-01'
      }
    }, {
      location: {
        city: 'Pune',
        coordinates: [999, 0]
      }
    }]) assert.equal((await api('post', '/projects').send({
      ...payload,
      ...data
    })).status, 400);
    assert.equal((await api('get', '/projects/not-an-id')).status, 400);
  });
  test('another NGO cannot access any project management operation', async () => {
    const p = await project();
    const a = await Application.create({
      userId: volunteer._id,
      projectId: p._id,
      contributionType: 'time'
    });
    for (const [method, suffix, body] of [['get', '', {}], ['put', '', {
      title: 'Stolen'
    }], ['patch', '/status', {
      status: 'team_forming'
    }], ['get', '/applicants', {}], ['patch', '/resources', {
      fundingSpent: 1,
      receiptNote: 'test'
    }], ['patch', '/complete', {}], ['post', '/photos', {
      category: 'after',
      urls: ['https://example.org/after.jpg']
    }]]) assert.equal((await api(method, `/projects/${p._id}${suffix}`, 'other').send(body)).status, 403);
    assert.equal((await api('patch', `/applications/${a._id}`, 'other').send({
      status: 'accepted'
    })).status, 403);
    assert.equal((await api('get', '/projects', 'other')).body.projects.length, 0);
  });
  test('all status entry points enforce order and completion prerequisites; impact is idempotent', async () => {
    const problemDoc = await problem();
    const adopted = await api('post', `/problems/${problemDoc._id}/adopt`).send(payload);
    const p = adopted.body.project;
    for (const [method, suffix] of [['patch', '/status'], ['put', ''], ['patch', '/complete']]) assert.equal((await api(method, `/projects/${p._id}${suffix}`).send({
      status: 'completed'
    })).status, 400);
    for (const status of ['team_forming', 'funding_needed', 'in_progress']) {
      const r = await api('patch', `/projects/${p._id}/status`).send({
        status
      });
      assert.equal(r.status, 200, r.text);
      assert.equal((await Problem.findById(problemDoc._id)).status, status);
    }
    assert.equal((await api('patch', `/projects/${p._id}/complete`).send({})).status, 400);
    await api('post', `/projects/${p._id}/photos`).send({
      category: 'after',
      urls: ['https://example.org/after.jpg']
    });
    assert.equal((await api('put', `/projects/${p._id}`).send({
      beneficiaries: {
        estimatedCount: 0
      }
    })).status, 200);
    assert.equal((await api('patch', `/projects/${p._id}/complete`).send({})).status, 400);
    await api('put', `/projects/${p._id}`).send({
      beneficiaries: {
        estimatedCount: 25
      }
    });
    assert.equal((await api('patch', `/projects/${p._id}/complete`).send({})).status, 200);
    assert.equal((await api('patch', `/projects/${p._id}/complete`).send({})).status, 200);
    let profile = await NGOProfile.findOne({
      userId: owner._id
    });
    assert.equal(profile.previousProjectsCount, 1);
    assert.equal(profile.totalBeneficiariesReached, 25);
    assert.equal(profile.totalVolunteerHours, 7.5);
    assert.equal((await Problem.findById(problemDoc._id)).status, 'completed');
    await api('put', `/projects/${p._id}`).send({
      beneficiaries: {
        estimatedCount: 30
      },
      volunteerHours: 8
    });
    profile = await NGOProfile.findOne({
      userId: owner._id
    });
    assert.equal(profile.totalBeneficiariesReached, 30);
    assert.equal(profile.totalVolunteerHours, 8);
    assert.equal((await api('put', `/projects/${p._id}`).send({
      beneficiaries: {
        estimatedCount: 0
      }
    })).status, 400);
  });
  test('simultaneous completions retain both projects in aggregate statistics', async () => {
    const [a, b] = await Promise.all([project({
      status: 'in_progress',
      photos: {
        after: ['https://example.org/a.jpg']
      }
    }), project({
      status: 'in_progress',
      photos: {
        after: ['https://example.org/b.jpg']
      }
    })]);
    const responses = await Promise.all([api('patch', `/projects/${a._id}/complete`).send({}), api('patch', `/projects/${b._id}/complete`).send({})]);
    assert.deepEqual(responses.map(r => r.status), [200, 200]);
    const stats = await NGOProfile.findOne({
      userId: owner._id
    });
    assert.equal(stats.previousProjectsCount, 2);
    assert.equal(stats.totalBeneficiariesReached, 50);
    assert.equal(stats.totalVolunteerHours, 15);
  });
  test('community applications remain visible after adoption and reviews update team atomically', async () => {
    const p = await problem();
    const applied = await request(app).post(`/api/problems/${p._id}/apply`).set('Authorization', `Bearer ${tokens.volunteer}`).send({
      contributionType: 'skills',
      relevantSkills: ['Gardening'],
      note: 'Available Saturday'
    });
    assert.equal(applied.status, 201, applied.text);
    const adopted = await api('post', `/problems/${p._id}/adopt`).send({});
    const projectId = adopted.body.project._id;
    const applicants = await api('get', `/projects/${projectId}/applicants`);
    assert.equal(applicants.body.applicants[0].userProfile.availability, 'Weekends');
    assert.equal(applicants.body.applicants[0].userProfile.subType, 'student');
    const applicationId = applied.body.application._id;
    const results = await Promise.all([api('patch', `/applications/${applicationId}`).send({
      status: 'accepted'
    }), api('patch', `/applications/${applicationId}`).send({
      status: 'accepted'
    })]);
    assert.deepEqual(results.map(r => r.status), [200, 200]);
    assert.equal((await Project.findById(projectId)).teamMembers.length, 1);
    assert.equal((await api('patch', `/applications/${applicationId}`).send({
      status: 'rejected'
    })).status, 409);
    const direct = await project();
    const rejected = await Application.create({
      userId: volunteer._id,
      projectId: direct._id,
      contributionType: 'time'
    });
    assert.equal((await api('patch', `/applications/${rejected._id}`).send({
      status: 'rejected'
    })).status, 200);
    assert.equal((await Project.findById(direct._id)).teamMembers.length, 0);
    const another = await project();
    await Application.create({
      userId: volunteer._id,
      projectId: another._id,
      contributionType: 'time'
    });
    await assert.rejects(Application.create({
      userId: volunteer._id,
      projectId: another._id,
      contributionType: 'time'
    }), e => e.code === 11000);
  });
  test('resources require and retain a note; general edits cannot bypass tracking', async () => {
    const p = await project();
    const materialId = String(p.materialsNeeded[0]._id);
    assert.equal((await api('patch', `/projects/${p._id}/resources`).send({
      fundingSpent: 50
    })).status, 400);
    const r = await api('patch', `/projects/${p._id}/resources`).send({
      fundingSpent: 50,
      receiptNote: 'Receipt R-100: plants',
      materials: [{
        _id: materialId,
        quantityReceived: 4
      }]
    });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.project.materialsNeeded[0].quantityReceived, 4);
    assert.equal(r.body.project.fundingSpent, 50);
    assert.equal(r.body.project.resourceUpdates[0].note, 'Receipt R-100: plants');
    assert.equal((await api('put', `/projects/${p._id}`).send({
      materialsNeeded: [{
        _id: materialId,
        item: 'Plants',
        quantityNeeded: 10,
        quantityReceived: 9
      }]
    })).status, 400);
    assert.equal((await api('patch', `/projects/${p._id}/resources`).send({
      receiptNote: 'bad',
      materials: [{
        _id: new mongoose.Types.ObjectId(),
        quantityReceived: 1
      }]
    })).status, 400);
    assert.equal((await api('patch', `/projects/${p._id}/resources`).send({
      receiptNote: 'bad',
      fundingSpent: -1
    })).status, 400);
  });
  test('multipart photos persist by stage and rejected uploads are cleaned up', async () => {
    const p = await project();
    for (const stage of ['before', 'progress', 'after']) {
      const r = await api('post', `/projects/${p._id}/photos`).field('category', stage).attach('photos', image, 'test.png');
      assert.equal(r.status, 200, r.text);
      const url = r.body.photos[stage][0];
      uploads.push(path.resolve(process.cwd(), '.' + url));
      assert.ok((await fs.stat(uploads.at(-1))).size > 0);
    }
    const directory = path.resolve(process.cwd(), 'uploads');
    const before = (await fs.readdir(directory)).sort();
    assert.equal((await api('post', `/projects/${p._id}/photos`).field('category', 'invalid').attach('photos', image, 'test.png')).status, 400);
    assert.deepEqual((await fs.readdir(directory)).sort(), before);
    assert.equal((await api('post', `/projects/${p._id}/photos`, 'other').field('category', 'after').attach('photos', image, 'test.png')).status, 403);
    assert.equal((await api('post', `/projects/${p._id}/photos`).field('category', 'after').attach('photos', Buffer.from('test'), 'test.txt')).status, 400);
  });
  test('summary counts match seeded projects, locations and pending applications', async () => {
    await problem();
    await problem({
      location: {
        city: 'Mumbai'
      }
    });
    const p = await problem();
    const adopted = await api('post', `/problems/${p._id}/adopt`).send({
      fundingRequired: 100
    });
    await Application.create({
      userId: volunteer._id,
      problemId: p._id,
      contributionType: 'time'
    });
    const complete = await project({
      status: 'in_progress',
      photos: {
        after: ['https://example.org/after.jpg']
      }
    });
    await api('patch', `/projects/${complete._id}/complete`).send({});
    await project({
      ngoId: other._id
    });
    const r = await api('get', '/dashboard-summary');
    assert.equal(r.status, 200, r.text);
    const s = r.body.summary;
    assert.equal(s.activeProjectsCount, 1);
    assert.equal(s.completedProjectsCount, 1);
    assert.equal(s.projectsNeedingFundingCount, 1);
    assert.equal(s.newNearbyProblemsCount, 1);
    assert.equal(s.pendingApplicationsCount, 1);
    assert.equal(s.pendingApplications.length, 1);
    assert.equal(s.activeProjects[0]._id, adopted.body.project._id);
    assert.equal(s.impactStats.totalVolunteerHours, 7.5);
  });
});
