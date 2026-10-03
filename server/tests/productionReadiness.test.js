import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import request from 'supertest';
import { validateProductionConfig, proxyTrust } from '../config/environment.js';
import { generateAccessToken, verifyAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/tokenUtils.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/emailService.js';
import { connectDB, disconnectDB } from '../config/db.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configKeys = ['NODE_ENV', 'CLIENT_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'MONGODB_URI', 'USE_IN_MEMORY_DB', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'UPLOAD_DIR', 'VERIFICATION_EVIDENCE_DIR', 'TRUST_PROXY'];
function productionEnv(directory) {
  return {
    NODE_ENV: 'production', CLIENT_URL: 'https://frontend.example.test',
    JWT_SECRET: randomBytes(32).toString('hex'), JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
    MONGODB_URI: 'mongodb://127.0.0.1:1/readiness', USE_IN_MEMORY_DB: 'false',
    SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', SMTP_USER: 'test-only',
    SMTP_PASS: randomBytes(24).toString('hex'), EMAIL_FROM: 'Test <mail@example.test>',
    UPLOAD_DIR: path.join(directory, 'photos'), VERIFICATION_EVIDENCE_DIR: path.join(directory, 'private'), TRUST_PROXY: ''
  };
}
async function withEnv(values, action) {
  const saved = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    return await action();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'karma-readiness-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function child(env, cwd, script) {
  const childEnv = { ...process.env, ...env };
  // Negative cases execute the real startup path, not the test-only import path.
  delete childEnv.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, script ? ['--input-type=module', '-e', script] : [path.join(serverRoot, 'server.js')], {
    cwd, env: childEnv, encoding: 'utf8', timeout: 15000, windowsHide: true
  });
}

test('production startup rejects every missing required setting before database connection or listening', t => {
  const directory = temporaryDirectory(t);
  const valid = productionEnv(directory);
  validateProductionConfig(valid);
  for (const key of configKeys.filter(key => !['NODE_ENV', 'TRUST_PROXY'].includes(key))) {
    const result = child({ ...valid, [key]: '' }, directory);
    assert.equal(result.status, 1, `${key}: ${result.stderr}`);
    assert.match(result.stderr, new RegExp(key));
    assert.doesNotMatch(result.stdout, /Connected to|Starting in-memory|Server running/);
    assert.ok(!result.stderr.includes(valid.JWT_SECRET));
    assert.ok(!result.stderr.includes(valid.SMTP_PASS));
  }
  assert.equal(fs.existsSync(valid.UPLOAD_DIR), false, 'configuration fails before storage side effects');
});

test('production rejects unsafe secrets, database mode, client URLs and storage overlap', t => {
  const directory = temporaryDirectory(t);
  const valid = productionEnv(directory);
  for (const updates of [
    { JWT_SECRET: 'dev_jwt_access_secret_fallback_key' },
    { JWT_SECRET: 'super_secret_jwt_access_token_key_change_in_production_32chars_min!' },
    { JWT_REFRESH_SECRET: valid.JWT_SECRET },
    { USE_IN_MEMORY_DB: 'true' }, { MONGODB_URI: 'invalid' },
    { CLIENT_URL: 'http://frontend.example.test' }, { CLIENT_URL: valid.CLIENT_URL + '/' },
    { CLIENT_URL: valid.CLIENT_URL + '/path' }, { SMTP_PORT: '587junk' },
    { SMTP_USER: 'your_smtp_username_here' }, { UPLOAD_DIR: 'relative' },
    { VERIFICATION_EVIDENCE_DIR: valid.UPLOAD_DIR },
    { VERIFICATION_EVIDENCE_DIR: path.join(valid.UPLOAD_DIR, 'private') },
    { UPLOAD_DIR: path.join(valid.VERIFICATION_EVIDENCE_DIR, 'public') },
    { VERIFICATION_EVIDENCE_DIR: path.join(serverRoot, '../client/dist/private') }
  ]) assert.throws(() => validateProductionConfig({ ...valid, ...updates }), /Production configuration/);
  assert.equal(proxyTrust({}), false);
  assert.deepEqual(proxyTrust({ TRUST_PROXY: '127.0.0.1, 10.20.0.0/24' }), ['127.0.0.1', '10.20.0.0/24']);
  for (const value of ['true', '1', '0.0.0.0/0', '::/0', '127.0.0.1,']) {
    assert.throws(() => proxyTrust({ TRUST_PROXY: value }), /TRUST_PROXY/);
  }
});

test('production loads .env before storage, serves configured photos, keeps evidence private and restricts CORS', t => {
  const directory = temporaryDirectory(t);
  const env = productionEnv(directory);
  fs.mkdirSync(env.UPLOAD_DIR);
  fs.mkdirSync(env.VERIFICATION_EVIDENCE_DIR);
  fs.writeFileSync(path.join(env.UPLOAD_DIR, 'photo.txt'), 'public-photo-fixture');
  fs.writeFileSync(path.join(env.VERIFICATION_EVIDENCE_DIR, 'secret.txt'), 'private-fixture');
  fs.writeFileSync(path.join(directory, '.env'), Object.entries(env).map(([k, v]) => `${k}=${v.replaceAll('\\', '/')}`).join('\n'));
  const script = `
    process.env.NODE_TEST_CONTEXT = 'readiness';
    const {default: app} = await import(${JSON.stringify(pathToFileURL(path.join(serverRoot, 'server.js')).href)});
    const {default: request} = await import(${JSON.stringify(pathToFileURL(path.join(serverRoot, 'node_modules/supertest/index.js')).href)});
    const {default: assert} = await import('node:assert/strict');
    assert.equal(app.get('trust proxy'), false);
    let response = await request(app).get('/api/health').set('Origin', process.env.CLIENT_URL);
    assert.equal(response.status, 200);
    assert.equal(response.headers['access-control-allow-origin'], process.env.CLIENT_URL);
    assert.equal(response.headers['access-control-allow-credentials'], 'true');
    for (const origin of ['http://localhost:5173', 'https://untrusted.example.test']) {
      response = await request(app).get('/api/health').set('Origin', origin);
      assert.equal(response.status, 403);
      assert.equal(response.headers['access-control-allow-origin'], undefined);
    }
    assert.equal((await request(app).get('/api/health')).status, 200);
    assert.equal((await request(app).get('/uploads/photo.txt')).text, 'public-photo-fixture');
    assert.equal((await request(app).get('/uploads/secret.txt')).status, 404);
    assert.equal((await request(app).get('/api/verification-evidence/ngo/test/secret.txt')).status, 401);
    response = await request(app).get('/api/unknown-route');
    assert.equal(response.status, 401); // Existing /api trust-router authentication runs first.
    assert.match(response.headers['content-type'], /json/);
  `;
  // Remove parent configuration so .env loading order is genuinely exercised.
  const saved = { ...process.env };
  let result;
  try {
    for (const key of configKeys) delete process.env[key];
    result = child({}, directory, script);
  } finally {
    for (const key of configKeys) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});

test('production tokens cannot fall back, while development fallback tokens still verify', async () => {
  const user = { _id: 'test-user', email: 'test@example.test', role: 'community_user' };
  await withEnv({ NODE_ENV: 'production', JWT_SECRET: undefined, JWT_REFRESH_SECRET: undefined }, async () => {
    assert.throws(() => generateAccessToken(user), /JWT_SECRET/);
    assert.throws(() => generateRefreshToken(user), /JWT_REFRESH_SECRET/);
    assert.throws(() => verifyAccessToken('anything'), /JWT_SECRET/);
    assert.throws(() => verifyRefreshToken('anything'), /JWT_REFRESH_SECRET/);
  });
  await withEnv({ NODE_ENV: 'development', JWT_SECRET: undefined, JWT_REFRESH_SECRET: undefined }, async () => {
    assert.equal(verifyAccessToken(generateAccessToken(user)).id, user._id);
    assert.equal(verifyRefreshToken(generateRefreshToken(user)).id, user._id);
  });
});

test('missing production SMTP rejects both email flows without logging links or sending mail', async t => {
  const log = t.mock.method(console, 'log', () => {});
  const transport = t.mock.method(nodemailer, 'createTransport', () => { throw new Error('Must not attempt delivery'); });
  await withEnv({ NODE_ENV: 'production', SMTP_HOST: undefined }, async () => {
    await assert.rejects(sendVerificationEmail('test@example.test', 'sensitive-token', 'Test'), /SMTP_HOST/);
    await assert.rejects(sendPasswordResetEmail('test@example.test', 'sensitive-token', 'Test'), /SMTP_HOST/);
  });
  assert.equal(log.mock.callCount(), 0);
  assert.equal(transport.mock.callCount(), 0);
});

test('production SMTP errors propagate safely; successful delivery works without logging content', async t => {
  const log = t.mock.method(console, 'log', () => {});
  const warn = t.mock.method(console, 'warn', () => {});
  let deliveries = 0;
  const transport = t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async () => { throw new Error('sensitive SMTP diagnostics'); } }));
  await withEnv(productionEnv(os.tmpdir()), async () => {
    for (const send of [sendVerificationEmail, sendPasswordResetEmail]) {
      await assert.rejects(send('test@example.test', 'sensitive-token', 'Test'), error => error.statusCode === 503 && !/sensitive/.test(error.message));
    }
    transport.mock.mockImplementation(() => ({ sendMail: async message => {
      deliveries++;
      assert.match(message.text, /https:\/\/frontend.example.test\//);
    } }));
    await sendVerificationEmail('test@example.test', 'sensitive-token', 'Test');
    await sendPasswordResetEmail('test@example.test', 'sensitive-token', 'Test');
  });
  assert.equal(deliveries, 2);
  assert.equal(log.mock.callCount(), 0);
  assert.equal(warn.mock.callCount(), 0);
});

test('production database guard refuses in-memory mode and standalone topology without exposing driver details', async t => {
  let calls = 0;
  t.mock.method(mongoose, 'connect', async () => {
    calls++;
    return { connection: { db: { admin: () => ({ command: async () => ({}) }) } } };
  });
  t.mock.method(mongoose, 'disconnect', async () => {});
  await withEnv({ NODE_ENV: 'production', USE_IN_MEMORY_DB: 'true' }, async () => {
    await assert.rejects(connectDB(), /USE_IN_MEMORY_DB/);
    assert.equal(calls, 0);
  });
  await withEnv({ NODE_ENV: 'production', USE_IN_MEMORY_DB: 'false', MONGODB_URI: 'mongodb://test:private-password@127.0.0.1:1/readiness' }, async () => {
    await assert.rejects(connectDB(), error => /replica-set\/sharded topology/.test(error.message) && !/private-password/.test(error.message));
    assert.equal(calls, 1);
  });
});

test('development signup, login, refresh, authenticated access and logout still work without SMTP', async t => {
  t.mock.method(console, 'log', () => {});
  await withEnv({ NODE_ENV: 'development', USE_IN_MEMORY_DB: 'true', REQUIRE_EMAIL_VERIFICATION: 'false', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', JWT_SECRET: '', JWT_REFRESH_SECRET: '' }, async () => {
    const { default: app } = await import('../server.js');
    try {
      await connectDB();
      const email = 'development-check@example.test';
      const password = randomBytes(16).toString('hex') + 'Aa1!';
      let response = await request(app).post('/api/auth/signup').send({ name: 'Development Check', email, password, role: 'community_user', subType: 'general_volunteer' });
      assert.equal(response.status, 201, response.text);
      response = await request(app).post('/api/auth/login').send({ email, password });
      assert.equal(response.status, 200, response.text);
      const cookie = response.headers['set-cookie'][0];
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Lax/);
      assert.doesNotMatch(cookie, /; Secure/);
      assert.equal((await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + response.body.accessToken)).status, 200);
      assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status, 200);
      assert.equal((await request(app).post('/api/auth/logout').set('Cookie', cookie)).status, 200);
      assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status, 401);
    } finally { await disconnectDB(); }
  });
});
