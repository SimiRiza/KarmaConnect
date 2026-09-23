// Read-only report. Server startup performs the approved resumable migration.
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/db.js';
import { migrationReport } from '../services/impactMigration.js';
dotenv.config();
try { await connectDB(); console.log(JSON.stringify(await migrationReport(), null, 2)); }
finally { await disconnectDB(); }
