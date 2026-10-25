import mongoose from 'mongoose';
import { pendingTeamBackfillQuery } from '../services/teamService.js';
import { migrationReport, hasPendingProgressReconciliation } from '../services/impactMigration.js';

const fail = message => { throw new Error(`Standalone development startup: ${message}`); };
const isLoopback = hosts => hosts?.length && hosts.every(({ host }) => ['localhost', '127.0.0.1', '::1'].includes(host));

// Validate before connecting, so an invalid opt-in cannot start an ephemeral DB.
export function validateStartupOptions(env = process.env) {
  const flag = env.ALLOW_STANDALONE_DEV_STARTUP;
  if (flag === undefined || flag === '' || flag === 'false') return false;
  if (flag !== 'true') fail('ALLOW_STANDALONE_DEV_STARTUP must be true or false.');
  if (env.NODE_ENV !== 'development') fail('ALLOW_STANDALONE_DEV_STARTUP=true is allowed only with NODE_ENV=development; never enable it in production.');
  if (env.USE_IN_MEMORY_DB !== 'false') fail('USE_IN_MEMORY_DB must be false.');
  if (!env.MONGODB_URI) fail('MONGODB_URI must explicitly select the application database.');
  let options;
  try { options = new mongoose.mongo.MongoClient(env.MONGODB_URI).options; }
  catch { fail('MONGODB_URI is invalid.'); }
  if (!isLoopback(options.hosts)) fail('MONGODB_URI must use a local loopback host (localhost, 127.0.0.1 or ::1).');
  if (['admin', 'config', 'local'].includes(options.dbName)) fail('A MongoDB system database cannot be used.');
  return true;
}

// This policy is used only by server startup. Runtime transaction helpers are unchanged.
export async function startupPolicy({ connection = mongoose.connection, env = process.env } = {}) {
  const optedIn = validateStartupOptions(env);
  const hello = await connection.db.admin().command({ hello: 1 });
  if (hello.setName || hello.msg === 'isdbgrid') return { mode: 'transaction-capable', indexesOnly: false };
  if (!optedIn) fail('MongoDB is standalone. Explicitly set ALLOW_STANDALONE_DEV_STARTUP=true in local development to request limited startup.');
  if (!isLoopback(connection.getClient().options.hosts)) fail('The connected MongoDB must also be local/loopback.');
  if (['admin', 'config', 'local'].includes(connection.name)) fail('A MongoDB system database cannot be used.');

  // Reuse the actual backfill query, migration report and progress calculation.
  // All eligibility checks are reads, before any startup preparation is performed.
  const [teams, impact, progress] = await Promise.all([
    pendingTeamBackfillQuery().limit(1).lean(),
    migrationReport(),
    hasPendingProgressReconciliation()
  ]);
  const pending = [];
  if (teams.length) pending.push('pending team backfill');
  if (impact.legacyRecords) pending.push('legacy contribution records');
  if (impact.awaitingProject) pending.push('unlinked contribution records');
  if (impact.completedWithoutSnapshot) pending.push('completed projects missing impact snapshots');
  if (progress) pending.push('project progress differs from milestone calculations');
  if (pending.length) fail(`Cannot skip required preparation: ${pending.join('; ')}. Prepare the database using a transaction-capable MongoDB before enabling standalone development startup. No startup migration was performed.`);
  return { mode: 'standalone-development', indexesOnly: true };
}
