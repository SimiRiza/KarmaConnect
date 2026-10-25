import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer, MongoMemoryReplSet } from 'mongodb-memory-server';
import { startupPolicy, validateStartupOptions } from '../config/startupPolicy.js';
import { prepareTeams } from '../services/teamService.js';
import { prepareImpact } from '../services/impactMigration.js';
import { strictTransaction } from '../utils/strictTransaction.js';
import { seedDemoData, demoModels } from '../scripts/seedDemoData.js';
import { generateAccessToken } from '../utils/tokenUtils.js';
import Project from '../models/Project.js';
import Contribution from '../models/Contribution.js';
import ImpactRecord from '../models/ImpactRecord.js';
import Team from '../models/Team.js';
import User from '../models/User.js';

const development = { NODE_ENV: 'development', USE_IN_MEMORY_DB: 'false', MONGODB_URI: 'mongodb://localhost:27017/startup_test', ALLOW_STANDALONE_DEV_STARTUP: 'true' };
const topology = (hello, host = 'localhost') => ({ db: { admin: () => ({ command: async () => hello }) }, getClient: () => ({ options: { hosts: [{ host }] } }), name: 'startup_test' });
async function withEnv(values, action) {
  const saved = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, values);
    return await action();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
const snapshot = () => Promise.all(demoModels.map(async Model => [Model.modelName, await Model.collection.find({}).sort({ _id: 1 }).toArray()]));

test('standalone startup is disabled by default and requires explicit true', async () => {
  for (const value of [undefined, '', 'false']) {
    const env = { ...development, ALLOW_STANDALONE_DEV_STARTUP: value };
    assert.equal(validateStartupOptions(env), false);
    await assert.rejects(startupPolicy({ env, connection: topology({}) }), /Explicitly set ALLOW_STANDALONE_DEV_STARTUP=true/);
  }
  assert.throws(() => validateStartupOptions({ ...development, ALLOW_STANDALONE_DEV_STARTUP: 'yes' }), /true or false/);
});

test('standalone opt-in rejects production and every non-development environment', () => {
  for (const NODE_ENV of ['production', 'test', 'staging', '', undefined]) {
    assert.throws(() => validateStartupOptions({ ...development, NODE_ENV }), /only with NODE_ENV=development/);
  }
});

test('standalone opt-in requires the configured persistent loopback database', async () => {
  for (const USE_IN_MEMORY_DB of ['true', '', undefined]) assert.throws(() => validateStartupOptions({ ...development, USE_IN_MEMORY_DB }), /USE_IN_MEMORY_DB must be false/);
  for (const MONGODB_URI of ['', undefined, 'invalid', 'mongodb://db.example.test/demo', 'mongodb://localhost.example.test/demo', 'mongodb://localhost,db.example.test/demo', 'mongodb://localhost/admin']) {
    assert.throws(() => validateStartupOptions({ ...development, MONGODB_URI }), /Standalone development startup/);
  }
  for (const host of ['localhost', '127.0.0.1', '[::1]']) assert.equal(validateStartupOptions({ ...development, MONGODB_URI: `mongodb://${host}/demo` }), true);
  await assert.rejects(startupPolicy({ env: development, connection: topology({}, 'db.example.test') }), /connected MongoDB must also be local/);
});

test('replica-set and mongos topologies select the unchanged normal path', async () => {
  for (const hello of [{ setName: 'rs0' }, { msg: 'isdbgrid' }]) {
    for (const env of [{ ...development, ALLOW_STANDALONE_DEV_STARTUP: 'false' }, development, { NODE_ENV: 'production' }]) {
      assert.deepEqual(await startupPolicy({ env, connection: topology(hello) }), { mode: 'transaction-capable', indexesOnly: false });
    }
  }
  await assert.rejects(startupPolicy({ env: { ...development, NODE_ENV: 'production' }, connection: topology({ setName: 'rs0' }) }), /never enable it in production/);
});

test('read-only eligibility uses the existing migration conditions and milestone calculation', async () => {
  const mongo = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongo.getUri('startup_eligibility'));
    const env = { ...development, MONGODB_URI: mongo.getUri('startup_eligibility') };
    const allowed = { mode: 'standalone-development', indexesOnly: true };
    assert.deepEqual(await startupPolicy({ env }), allowed);
    const cases = [
      [Project, { teamMembers: [new mongoose.Types.ObjectId()], teamId: null, progressPercentage: 0 }, /pending team backfill/],
      [Contribution, { schemaVersion: 1, projectId: new mongoose.Types.ObjectId() }, /legacy contribution records/],
      [Contribution, { schemaVersion: 2, projectId: null }, /unlinked contribution records/],
      [Project, { status: 'completed', progressPercentage: 0 }, /missing impact snapshots/],
      [Project, { milestones: [{ completed: true }], progressPercentage: 0 }, /progress differs/]
    ];
    for (const [Model, data, message] of cases) {
      const { insertedId } = await Model.collection.insertOne(data);
      const before = await snapshot();
      await assert.rejects(startupPolicy({ env }), message);
      assert.deepEqual(await snapshot(), before, 'eligibility must not write or partially migrate');
      await Model.collection.deleteOne({ _id: insertedId });
    }
    // Awaiting human review alone is not a migration condition in prepareImpact().
    await Contribution.collection.insertOne({ schemaVersion: 2, projectId: new mongoose.Types.ObjectId(), legacyNeedsReview: true });
    const { insertedId: projectId } = await Project.collection.insertOne({ status: 'completed', progressPercentage: 50, milestones: [{ completed: true }, { completed: false }], teamMembers: [] });
    await ImpactRecord.collection.insertOne({ projectId });
    assert.deepEqual(await startupPolicy({ env }), allowed);
  } finally { await mongoose.disconnect(); await mongo.stop(); }
});

test('standalone index-only preparation never starts transactions; runtime strictTransaction still rejects', async t => {
  const mongo = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongo.getUri('startup_indexes'));
    const { insertedId } = await Project.collection.insertOne({ progressPercentage: 0, milestones: [] });
    const policy = await startupPolicy({ env: { ...development, MONGODB_URI: mongo.getUri('startup_indexes') } });
    const before = await snapshot();
    const session = t.mock.method(mongoose, 'startSession', () => { throw new Error('Unexpected startup transaction'); });
    try { await prepareTeams(policy); await prepareImpact(policy); }
    finally { session.mock.restore(); }
    assert.deepEqual(await snapshot(), before);
    assert.ok((await Team.collection.indexes()).length > 1);
    assert.ok((await ImpactRecord.collection.indexes()).length > 1);
    await assert.rejects(strictTransaction(s => Project.collection.updateOne({ _id: insertedId }, { $inc: { __v: 1 } }, { session: s })), error => error.statusCode === 503 && /requires MongoDB running as a replica set/.test(error.message));
    assert.deepEqual(await snapshot(), before);
  } finally { await mongoose.disconnect(); await mongo.stop(); }
});

test('transaction-capable startup still performs team backfill and impact reconciliation in transactions', async t => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  try {
    await mongoose.connect(mongo.getUri('startup_replica'));
    await withEnv({ ...development, MONGODB_URI: mongo.getUri('startup_replica') }, async () => {
      await seedDemoData({ log: () => {} });
      const project = await Project.findOne({ 'teamMembers.0': { $exists: true } });
      const originalTeam = project.teamId;
      await Project.collection.updateOne({ _id: project._id }, { $set: { teamId: null, progressPercentage: -1 } });
      const openSession = mongoose.startSession.bind(mongoose);
      let transactions = 0;
      const spy = t.mock.method(mongoose, 'startSession', async (...args) => {
        const session = await openSession(...args);
        const transaction = session.withTransaction.bind(session);
        session.withTransaction = (...values) => { transactions++; return transaction(...values); };
        return session;
      });
      try {
        const policy = await startupPolicy();
        assert.equal(policy.indexesOnly, false);
        await prepareTeams(policy); await prepareImpact(policy);
      } finally { spy.mock.restore(); }
      const restored = await Project.findById(project._id);
      assert.equal(String(restored.teamId), String(originalTeam));
      assert.equal(restored.progressPercentage, project.progressPercentage);
      assert.equal(transactions, 1 + await Project.countDocuments());
    });
  } finally { await mongoose.disconnect(); await mongo.stop(); }
});

async function freePort() {
  const server = net.createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}

test('real server startup refuses unsafe modes before preparation and serves eligible standalone data without changing it', async () => {
  const mongo = await MongoMemoryServer.create();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'karma-startup-'));
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let child;
  async function stop() {
    if (child && child.exitCode === null) { const exit = once(child, 'exit'); child.kill(); await exit; }
  }
  try {
    await mongoose.connect(mongo.getUri('startup_server'));
    const env = { ...development, MONGODB_URI: mongo.getUri('startup_server'), ALLOW_STANDALONE_DEMO_SEED: 'true', JWT_SECRET: randomBytes(32).toString('hex'), JWT_REFRESH_SECRET: randomBytes(32).toString('hex') };
    await withEnv(env, async () => {
      await seedDemoData({ log: () => {} });
      const port = await freePort();
      const childEnv = { ...process.env, ...env, PORT: String(port), UPLOAD_DIR: path.join(directory, 'photos'), VERIFICATION_EVIDENCE_DIR: path.join(directory, 'evidence'), SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '' };
      delete childEnv.NODE_TEST_CONTEXT;
      const start = extra => {
        let output = '';
        child = spawn(process.execPath, [path.join(serverRoot, 'server.js')], { cwd: directory, env: { ...childEnv, ...extra }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
        return () => output;
      };
      async function rejected(extra, message) {
        const before = await snapshot(); const output = start(extra);
        const timeout = setTimeout(() => child.kill(), 15000);
        let code; try { [code] = await once(child, 'exit'); } finally { clearTimeout(timeout); }
        assert.equal(code, 1, output()); assert.match(output(), message);
        assert.doesNotMatch(output(), /Server running/); assert.deepEqual(await snapshot(), before);
      }
      await rejected({ ALLOW_STANDALONE_DEV_STARTUP: 'false' }, /Explicitly set ALLOW_STANDALONE_DEV_STARTUP=true/);
      // A pending migration must be rejected before even the nontransactional trust backfill.
      const p = await Project.findOne();
      await Project.collection.updateOne({ _id: p._id }, { $unset: { requiresAuthorityApproval: '' } });
      const { insertedId } = await Contribution.collection.insertOne({ schemaVersion: 1, projectId: p._id });
      await rejected({}, /legacy contribution records/);
      await Contribution.collection.deleteOne({ _id: insertedId });
      await Project.collection.updateOne({ _id: p._id }, { $set: { requiresAuthorityApproval: p.requiresAuthorityApproval } });
      const before = await snapshot(); const output = start({});
      let ready = false;
      for (let i = 0; i < 100; i++) {
        if (child.exitCode !== null) break;
        if (output().includes('Server running')) { ready = true; break; }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.ok(ready, output()); assert.match(output(), /Transaction-dependent runtime features still require/);
      const base = `http://127.0.0.1:${port}`;
      assert.equal((await fetch(base + '/api/health')).status, 200);
      assert.deepEqual(await snapshot(), before);
      const member = await User.findOne({ role: 'community_user' });
      const response = await fetch(base + `/api/projects/${p._id}/progress-summary`, { headers: { Authorization: 'Bearer ' + generateAccessToken(member) } });
      assert.equal(response.status, 503);
      assert.match((await response.json()).message, /requires MongoDB running as a replica set/);
      assert.deepEqual(await snapshot(), before, 'failed runtime transaction must not change project data');
    });
  } finally {
    await stop(); await mongoose.disconnect(); await mongo.stop();
    if (!path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error('Unexpected test directory');
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
