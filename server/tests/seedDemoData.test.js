import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer, MongoMemoryReplSet } from 'mongodb-memory-server';
import { seedDemoData, demoSeedMode, demoModels } from '../scripts/seedDemoData.js';
import User from '../models/User.js';
import Project from '../models/Project.js';
import ImpactRecord from '../models/ImpactRecord.js';

const quiet = () => {};
const local = { hello: {}, hosts: [{ host: '127.0.0.1' }], dbName: 'seed_regression' };
const development = { NODE_ENV: 'development', USE_IN_MEMORY_DB: 'false', ALLOW_STANDALONE_DEMO_SEED: 'true' };
async function withEnvironment(values, action) {
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
async function snapshot() {
  return Promise.all(demoModels.map(async Model => [Model.modelName, await Model.collection.find({}).sort({ _id: 1 }).toArray()]));
}
async function addSentinels() {
  for (const Model of demoModels) await Model.collection.insertOne({ _id: new mongoose.Types.ObjectId(), nonSeedSentinel: true });
}
async function checkSentinels() {
  for (const Model of demoModels) assert.equal(await Model.collection.countDocuments({ nonSeedSentinel: true }), 1, Model.modelName);
}
async function checkSeed() {
  assert.equal(await User.collection.countDocuments({ isSeedData: true }), 14);
  for (const Model of demoModels) {
    assert.ok(await Model.collection.countDocuments({ isSeedData: true }) > 0, Model.modelName);
    assert.equal(await Model.collection.countDocuments({ isSeedData: { $ne: true }, nonSeedSentinel: { $ne: true } }), 0, Model.modelName);
  }
  assert.equal(await ImpactRecord.collection.countDocuments({ isSeedData: true }), 2);
  const user = await User.findOne({ email: 'volunteer1@demo.karmaconnect.test' }).select('+passwordHash');
  assert.equal(user.isEmailVerified, true);
  assert.equal(await bcrypt.compare('Demo@1234', user.passwordHash), true);
  await checkSentinels();
}

test('seed policy rejects production, missing opt-in, remote standalone and system databases', async () => {
  for (const env of [
    { ...development, NODE_ENV: 'production' },
    { ...development, NODE_ENV: 'test' },
    { ...development, NODE_ENV: '' },
    { ...development, ALLOW_STANDALONE_DEMO_SEED: '' },
    { ...development, USE_IN_MEMORY_DB: 'true' }
  ]) assert.throws(() => demoSeedMode({ ...local, env }));
  assert.throws(() => demoSeedMode({ ...local, env: development, hosts: [{ host: 'database.example.test' }] }), /loopback/);
  for (const dbName of ['admin', 'config', 'local', '']) assert.throws(() => demoSeedMode({ ...local, dbName, env: development }), /database/);
  assert.equal(demoSeedMode({ ...local, env: development }), 'standalone');
  for (const hello of [{ setName: 'rs0' }, { msg: 'isdbgrid' }]) {
    assert.equal(demoSeedMode({ ...local, hello, env: { NODE_ENV: 'development' } }), 'transaction');
    assert.throws(() => demoSeedMode({ ...local, hello, env: { NODE_ENV: 'production' } }), /forbidden/);
  }
  await withEnvironment({ NODE_ENV: 'production' }, async () => {
    await assert.rejects(seedDemoData({ log: quiet }), /forbidden/);
    await assert.rejects(seedDemoData({ clear: true, log: quiet }), /forbidden/);
  });
  for (const args of [[], ['--clear']]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/seedDemoData.js', import.meta.url)), ...args], {
      env: { ...process.env, NODE_ENV: 'production', ALLOW_STANDALONE_DEMO_SEED: 'true' }, encoding: 'utf8', timeout: 15000, windowsHide: true
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /forbidden/);
  }
});

test('standalone seed is opted-in, tagged, repeatable, collision-safe and cleans up failed writes', async t => {
  const mongo = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongo.getUri('seed_standalone_regression'));
    await withEnvironment(development, async () => {
      await addSentinels();
      const original = await snapshot();
      await withEnvironment({ ALLOW_STANDALONE_DEMO_SEED: '' }, async () => {
        await assert.rejects(seedDemoData({ log: quiet }), /ALLOW_STANDALONE/);
        await assert.rejects(seedDemoData({ clear: true, log: quiet }), /ALLOW_STANDALONE/);
      });
      assert.deepEqual(await snapshot(), original);
      const messages = [];
      await seedDemoData({ log: message => messages.push(message) });
      assert.ok(messages.some(message => message.includes('NOT atomic')));
      await checkSeed();
      const first = await User.collection.findOne({ email: 'volunteer1@demo.karmaconnect.test' });
      await seedDemoData({ log: quiet });
      await checkSeed();
      assert.equal(await User.collection.countDocuments({ _id: first._id }), 0);

      // A non-demo account must abort before removing even previously tagged records.
      const colliding = await User.collection.findOne({ email: 'volunteer8@demo.karmaconnect.test' });
      await User.collection.updateOne({ _id: colliding._id }, { $unset: { isSeedData: '' } });
      const beforeCollision = await snapshot();
      await assert.rejects(seedDemoData({ log: quiet }), /non-demo account/);
      assert.deepEqual(await snapshot(), beforeCollision);
      await User.collection.updateOne({ _id: colliding._id }, { $set: { isSeedData: true } });

      // Failure after a write acknowledgement: tagged data from this run is removable.
      const originalInsert = Project.collection.insertOne;
      const writeFailure = t.mock.method(Project.collection, 'insertOne', async function (...args) {
        await originalInsert.apply(this, args);
        throw new Error('Injected post-insert failure');
      });
      try { await assert.rejects(seedDemoData({ log: quiet }), /Injected post-insert failure/); }
      finally { writeFailure.mock.restore(); }
      for (const Model of demoModels) assert.equal(await Model.collection.countDocuments({ isSeedData: true }), 0);
      await checkSentinels();

      // Impact snapshots are generated by an existing service, then tagged by the seed.
      const tagFailure = t.mock.method(ImpactRecord.collection, 'updateOne', async () => { throw new Error('Injected snapshot tag failure'); });
      try { await assert.rejects(seedDemoData({ log: quiet }), /Injected snapshot tag failure/); }
      finally { tagFailure.mock.restore(); }
      assert.deepEqual(await snapshot(), original);
      await seedDemoData({ log: quiet });
      await checkSeed();
      await seedDemoData({ clear: true, log: quiet });
      assert.deepEqual(await snapshot(), original);
      await seedDemoData({ clear: true, log: quiet });
      assert.deepEqual(await snapshot(), original);
    });
  } finally { await mongoose.disconnect(); await mongo.stop(); }
});

test('replica-set seed still uses transactions and rolls back replacement on failure', async t => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  try {
    await mongoose.connect(mongo.getUri('seed_replica_regression'));
    await withEnvironment({ ...development, ALLOW_STANDALONE_DEMO_SEED: '' }, async () => {
      await addSentinels();
      const original = await snapshot();
      const insert = User.collection.insertOne;
      let transactionalWrites = 0;
      const spy = t.mock.method(User.collection, 'insertOne', async function (data, options) {
        assert.equal(options.session.inTransaction(), true);
        transactionalWrites++;
        return insert.call(this, data, options);
      });
      try { await seedDemoData({ log: quiet }); }
      finally { spy.mock.restore(); }
      assert.equal(transactionalWrites, 14);
      await checkSeed();
      const previousDemo = await snapshot();
      const failure = t.mock.method(Project.collection, 'insertOne', async () => { throw new Error('Injected transaction failure'); });
      try { await assert.rejects(seedDemoData({ log: quiet }), /Injected transaction failure/); }
      finally { failure.mock.restore(); }
      assert.deepEqual(await snapshot(), previousDemo);
      await seedDemoData({ clear: true, log: quiet });
      assert.deepEqual(await snapshot(), original);
    });
  } finally { await mongoose.disconnect(); await mongo.stop(); }
});
