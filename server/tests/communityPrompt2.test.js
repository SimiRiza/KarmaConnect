import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../server.js';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import Problem from '../models/Problem.js';
import CommunityUserProfile from '../models/CommunityUserProfile.js';

describe('Prompt 2 Community User API', () => {
  let accessToken = '';
  let userId = '';
  let problemId = '';

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.USE_IN_MEMORY_DB = 'true';
    process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
    await connectDB();

    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Prompt User',
        email: `prompt_user_${Date.now()}@test.org`,
        password: 'Password123!',
        role: 'community_user',
        subType: 'student',
        skills: ['React', 'Design'],
        interests: ['Environment'],
        causeAreas: ['Education'],
        bio: 'Community volunteer'
      });

    accessToken = signupRes.body.accessToken;
    userId = signupRes.body.user._id;
  });

  after(async () => {
    await disconnectDB();
  });

  test('profile endpoint returns user and profile', async () => {
    const res = await request(app)
      .get('/api/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.role, 'community_user');
    assert.equal(Array.isArray(res.body.profile.skills), true);
  });

  test('user can post a problem', async () => {
    const res = await request(app)
      .post('/api/problems')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'School library cleanup',
        description: 'We need volunteers to tidy the local school library and repair shelves.',
        category: 'education',
        photos: ['https://example.com/photo1.jpg'],
        location: { city: 'Bengaluru', area: 'Koramangala', coordinates: [77.61, 12.97] },
        urgency: 'medium',
        estimatedResourcesNeeded: '3 volunteers and cleaning supplies'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.problem.postedBy, userId);
    problemId = res.body.problem._id;
  });

  test('discover list supports filters and pagination', async () => {
    const res = await request(app)
      .get('/api/problems?city=Bengaluru&category=education&urgency=medium&page=1&limit=10')
      .set('Authorization', `Bearer ${accessToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.items.length >= 1, true);
    assert.equal(res.body.items[0].location.city, 'Bengaluru');
  });

  test('user can apply only once to a problem', async () => {
    const first = await request(app)
      .post(`/api/problems/${problemId}/apply`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        contributionType: 'time',
        relevantSkills: ['Teaching'],
        note: 'I can help on Saturday morning.'
      });

    const second = await request(app)
      .post(`/api/problems/${problemId}/apply`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        contributionType: 'skills',
        relevantSkills: ['Design'],
        note: 'Second attempt'
      });

    assert.equal(first.status, 201);
    assert.equal(first.body.success, true);
    assert.equal(second.status, 409);
    assert.equal(second.body.success, false);
  });

  test('user can save and unsave a problem', async () => {
    const saveRes = await request(app)
      .post(`/api/problems/${problemId}/save`)
      .set('Authorization', `Bearer ${accessToken}`);

    const listRes = await request(app)
      .get('/api/users/me/saved')
      .set('Authorization', `Bearer ${accessToken}`);

    const deleteRes = await request(app)
      .delete(`/api/problems/${problemId}/save`)
      .set('Authorization', `Bearer ${accessToken}`);

    assert.equal(saveRes.status, 200);
    assert.equal(listRes.status, 200);
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.body.success, true);
  });
});
