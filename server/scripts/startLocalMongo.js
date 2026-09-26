// Start the project's persistent local replica set before the development server.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, 'server/.env') });
const uri = process.env.MONGODB_URI || '';
const local = /^mongodb:\/\/127\.0\.0\.1:27018\/karmaconnect\?replicaSet=karmaLocal$/.test(uri);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function listening() {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port: 27018 });
    const done = value => { socket.destroy(); resolve(value); };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(1000, () => done(false));
  });
}
async function main() {
  if (!local || process.env.USE_IN_MEMORY_DB === 'true' || ['production', 'test'].includes(process.env.NODE_ENV)) return;
  let spawnError;
  if (!await listening()) {
    const cached = path.join(os.homedir(), '.cache/mongodb-binaries/mongod-x64-win32-7.0.24.exe');
    const binary = process.env.MONGOD_BINARY || (process.platform === 'win32' && existsSync(cached) ? cached : 'mongod');
    const dbPath = path.join(root, '.local/mongodb');
    mkdirSync(dbPath, { recursive: true });
    const child = spawn(binary, ['--dbpath', dbPath, '--port', '27018', '--bind_ip', '127.0.0.1', '--replSet', 'karmaLocal', '--logpath', path.join(dbPath, 'mongod.log'), '--logappend'], { detached: true, windowsHide: true, stdio: 'ignore' });
    child.once('error', error => { spawnError = error; });
    child.unref();
    console.log('Starting persistent local MongoDB on port 27018...');
  }
  const deadline = Date.now() + 45000;
  let initiated = false;
  while (Date.now() < deadline) {
    if (spawnError) throw new Error('Could not launch mongod. Install MongoDB or set MONGOD_BINARY to its executable.');
    const client = new mongoose.mongo.MongoClient('mongodb://127.0.0.1:27018/?directConnection=true', { serverSelectionTimeoutMS: 1000 });
    try {
      await client.connect();
      const admin = client.db('admin');
      const hello = await admin.command({ hello: 1 });
      if (hello.setName && hello.setName !== 'karmaLocal') throw new Error('Port 27018 belongs to a different replica set; no configuration was changed.');
      if (hello.setName === 'karmaLocal' && hello.isWritablePrimary) {
        console.log('Persistent MongoDB ready: karmaLocal, port 27018.');
        return;
      }
      if (!hello.setName && !initiated) {
        try { await admin.command({ replSetGetStatus: 1 }); }
        catch (error) {
          if (error.code !== 94) throw error;
          await admin.command({ replSetInitiate: { _id: 'karmaLocal', members: [{ _id: 0, host: '127.0.0.1:27018' }] } });
          initiated = true;
        }
      }
    } catch (error) {
      if (!['MongoServerSelectionError', 'MongoNetworkError'].includes(error.name)) throw error;
    } finally { await client.close(); }
    await delay(500);
  }
  throw new Error('Local MongoDB did not become ready. Check .local/mongodb/mongod.log.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
