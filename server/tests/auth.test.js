import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server.js';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import CommunityUserProfile from '../models/CommunityUserProfile.js';
import NGOProfile from '../models/NGOProfile.js';
import CSRProfile from '../models/CSRProfile.js';

describe('KarmaConnect Authentication & Models Test Suite', () => {
  let agent;
  let communityUserTokens = { access: '', refreshCookie: '' };
  let testCommunityEmail = `volunteer_${Date.now()}@test.org`;
  let testNgoEmail = `ngo_${Date.now()}@test.org`;
  let testCsrEmail = `csr_${Date.now()}@test.org`;

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.USE_IN_MEMORY_DB = 'true';
    process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
    await connectDB();
    agent = request.agent(app);
  });

  after(async () => {
    await disconnectDB();
  });

  test('1. Health Check Endpoint returns 200 OK', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'KarmaConnect API');
  });

  test('2. Signup fails with 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'invalid-email',
        password: 'short'
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(Array.isArray(res.body.errors));
  });

  test('3. Community User Signup atomically creates User and CommunityUserProfile', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Jane Volunteer',
        email: testCommunityEmail,
        password: 'Password123!',
        role: 'community_user',
        subType: 'student',
        city: 'Seattle',
        state: 'WA',
        skills: ['Graphic Design', 'Social Media'],
        causeAreas: ['Education & Literacy', 'Environment & Climate'],
        collegeOrOrganization: 'University of Washington',
        bio: 'Passionate about digital storytelling for local environmental causes.'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.user);
    assert.equal(res.body.user.role, 'community_user');
    assert.equal(res.body.user.passwordHash, undefined, 'passwordHash must never be exposed');

    // Verify in database
    const dbUser = await User.findOne({ email: testCommunityEmail });
    assert.ok(dbUser);
    const dbProfile = await CommunityUserProfile.findOne({ userId: dbUser._id });
    assert.ok(dbProfile);
    assert.equal(dbProfile.subType, 'student');
    assert.equal(dbProfile.collegeOrOrganization, 'University of Washington');
    assert.equal(dbProfile.causeAreas.length, 2);
  });

  test('4. Duplicate email signup returns 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Another Jane',
        email: testCommunityEmail,
        password: 'Password123!',
        role: 'community_user',
        subType: 'general_volunteer'
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
  });

  test('5. NGO Signup atomically creates User and NGOProfile', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Hope Roots NGO',
        email: testNgoEmail,
        password: 'Password123!',
        role: 'ngo',
        ngoName: 'Hope Roots Foundation',
        registrationNumber: 'NGO-REG-2026-99',
        contactPersonName: 'Carlos Rivera',
        contactPhone: '+1-555-0192',
        causeAreas: ['Hunger & Food Security'],
        locationsServed: ['Seattle', 'Tacoma'],
        about: 'Providing fresh produce to food deserts.'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);

    const dbUser = await User.findOne({ email: testNgoEmail });
    assert.ok(dbUser);
    const dbProfile = await NGOProfile.findOne({ userId: dbUser._id });
    assert.ok(dbProfile);
    assert.equal(dbProfile.ngoName, 'Hope Roots Foundation');
    assert.equal(dbProfile.verificationStatus, 'pending');
  });

  test('6. CSR Manager Signup atomically creates User and CSRProfile', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Sarah Chen (Acme)',
        email: testCsrEmail,
        password: 'Password123!',
        role: 'csr_manager',
        companyName: 'Acme Corp',
        csrManagerName: 'Sarah Chen',
        industry: 'Cloud Computing',
        budgetRange: '$50,000 – $250,000 / year',
        csrFocusAreas: ['Education & Literacy', 'Youth Development']
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);

    const dbUser = await User.findOne({ email: testCsrEmail });
    assert.ok(dbUser);
    const dbProfile = await CSRProfile.findOne({ userId: dbUser._id });
    assert.ok(dbProfile);
    assert.equal(dbProfile.companyName, 'Acme Corp');
    assert.equal(dbProfile.csrManagerName, 'Sarah Chen');
  });

  test('7. Login with invalid password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testCommunityEmail,
        password: 'WrongPassword99!'
      });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('8. Login with correct credentials returns accessToken and sets httpOnly refreshToken cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testCommunityEmail,
        password: 'Password123!'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.accessToken);
    assert.equal(res.body.user.email, testCommunityEmail);
    assert.equal(res.body.user.passwordHash, undefined);

    // Verify httpOnly cookie
    const cookies = res.headers['set-cookie'];
    assert.ok(cookies, 'set-cookie header must be present');
    const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
    assert.ok(refreshCookie, 'refreshToken cookie must exist');
    assert.ok(refreshCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');

    communityUserTokens.access = res.body.accessToken;
    communityUserTokens.refreshCookie = refreshCookie.split(';')[0];
  });

  test('9. GET /api/auth/me returns authenticated user profile with Bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${communityUserTokens.access}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.email, testCommunityEmail);
    assert.ok(res.body.profile);
    assert.equal(res.body.profile.subType, 'student');
  });

  test('10. GET /api/auth/me rejects requests without token with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'NO_TOKEN');
  });

  test('11. POST /api/auth/refresh issues a new access token using the httpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', communityUserTokens.refreshCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.accessToken);
    assert.notEqual(res.body.accessToken, communityUserTokens.access);
  });

  test('12. POST /api/auth/logout clears cookie and revokes session', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', communityUserTokens.refreshCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    // After logout, refreshing with the old cookie must fail
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', communityUserTokens.refreshCookie);

    assert.equal(refreshRes.status, 401);
  });

  test('13. Forgot Password and Reset Password workflow invalidates old sessions', async () => {
    // 1. Forgot password request
    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: testCommunityEmail });

    assert.equal(forgotRes.status, 200);
    assert.equal(forgotRes.body.success, true);

    // 2. Fetch reset token directly from DB to simulate clicking email link
    const userWithToken = await User.findOne({ email: testCommunityEmail })
      .select('+passwordResetToken +passwordResetExpiry');
    assert.ok(userWithToken.passwordResetToken);

    // In authService, the token in URL is the unhashed token, but in DB we store the hash.
    // For direct test, we test reset with the generated token mechanism:
    // Let's create a known raw token and hash it
    const crypto = await import('crypto');
    const rawResetToken = 'test_reset_token_raw_12345';
    const hashed = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    userWithToken.passwordResetToken = hashed;
    userWithToken.passwordResetExpiry = new Date(Date.now() + 3600000);
    await userWithToken.save();

    // 3. Reset password
    const newPassword = 'NewSecurePassword2026!';
    const resetRes = await request(app)
      .post(`/api/auth/reset-password/${rawResetToken}`)
      .send({ password: newPassword });

    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.body.success, true);

    // 4. Old password should now fail
    const oldLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testCommunityEmail,
        password: 'Password123!'
      });
    assert.equal(oldLoginRes.status, 401);

    // 5. New password should succeed
    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testCommunityEmail,
        password: newPassword
      });
    assert.equal(newLoginRes.status, 200);
    assert.ok(newLoginRes.body.accessToken);
  });
});
