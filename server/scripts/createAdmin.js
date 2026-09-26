// Creates only the first admin. Credentials are supplied by the operator, never logged.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createAdmin } from '../services/adminService.js';
export async function run() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({
    path: path.resolve(dir, '../.env')
  });
  dotenv.config({
    path: path.resolve(dir, '../../.env')
  });
  if (process.env.USE_IN_MEMORY_DB === 'true') throw new Error('Configure a persistent MONGODB_URI and USE_IN_MEMORY_DB=false first.');
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/karmaconnect', {
      serverSelectionTimeoutMS: 5000
    });
    const r = await createAdmin({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    }, true);
    console.log(r.created ? 'First administrator created. Sign in with the credentials you supplied.' : 'An administrator already exists. No account was changed.');
  } finally {
    await mongoose.disconnect();
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) run().catch(e => {
  console.error(e.name?.startsWith('Mongo') ? 'Admin creation failed. Check database connectivity and unique account constraints.' : e.message);
  process.exitCode = 1;
});
