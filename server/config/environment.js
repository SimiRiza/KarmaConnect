import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Imported before routes: storage modules must see the same .env as the server.
dotenv.config();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fail = message => { throw new Error(`Production configuration: ${message}`); };

export function authSecret(name, fallback, env = process.env) {
  const value = env[name];
  if (env.NODE_ENV === 'production') {
    if (!value || value.trim().length < 32 || /dev_jwt_|change_in_production/i.test(value)) {
      fail(`${name} must be a unique random secret of at least 32 characters, not a development/example value.`);
    }
    if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) fail('JWT_SECRET and JWT_REFRESH_SECRET must differ.');
  }
  return value || fallback;
}

export function validateDatabaseConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  if (env.USE_IN_MEMORY_DB !== 'false') fail('USE_IN_MEMORY_DB must be false.');
  if (!/^mongodb(?:\+srv)?:\/\/\S+$/.test(env.MONGODB_URI || '')) {
    fail('MONGODB_URI must point to a persistent MongoDB replica set or sharded deployment.');
  }
}

export function validateEmailConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM']) {
    if (!env[key]?.trim() || /^your_smtp_/i.test(env[key])) fail(`${key} is required for email delivery.`);
  }
  if (!/^\d+$/.test(env.SMTP_PORT) || Number(env.SMTP_PORT) < 1 || Number(env.SMTP_PORT) > 65535) {
    fail('SMTP_PORT must be an integer from 1 to 65535.');
  }
  if (/[\r\n]/.test(env.EMAIL_FROM) || !/\S+@\S+/.test(env.EMAIL_FROM)) fail('EMAIL_FROM must identify an authorized sender email address.');
}

export function storageDirectories(env = process.env) {
  return {
    uploads: path.resolve(env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')),
    evidence: path.resolve(env.VERIFICATION_EVIDENCE_DIR || path.join(root, '.local/verification-evidence'))
  };
}

const inside = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};

export function validateStorageSeparation(uploads, evidence) {
  if (inside(uploads, evidence) || inside(evidence, uploads)) fail('UPLOAD_DIR and VERIFICATION_EVIDENCE_DIR must be separate, non-overlapping directories.');
  for (const publicRoot of [path.join(root, 'client/dist'), path.join(root, 'client/public')]) {
    if (inside(publicRoot, evidence)) fail('VERIFICATION_EVIDENCE_DIR must be outside frontend public directories.');
  }
}

export function proxyTrust(env = process.env) {
  if (!env.TRUST_PROXY?.trim()) return false;
  const entries = env.TRUST_PROXY.split(',').map(value => value.trim());
  if (entries.some(value => !value || /^(?:true|false|\d+)$/.test(value) || /\/(?:0)$/.test(value))) {
    throw new Error('TRUST_PROXY must list explicit trusted proxy addresses/subnets, not booleans, hop counts or all-address ranges.');
  }
  return entries;
}

export function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  authSecret('JWT_SECRET', undefined, env);
  authSecret('JWT_REFRESH_SECRET', undefined, env);
  let client;
  try { client = new URL(env.CLIENT_URL); } catch { fail('CLIENT_URL must be an exact HTTPS origin.'); }
  if (client.protocol !== 'https:' || client.origin !== env.CLIENT_URL || client.username || client.password) {
    fail('CLIENT_URL must be an exact HTTPS origin without a path or trailing slash.');
  }
  validateDatabaseConfig(env);
  validateEmailConfig(env);
  for (const key of ['UPLOAD_DIR', 'VERIFICATION_EVIDENCE_DIR']) {
    if (!env[key]?.trim() || !path.isAbsolute(env[key])) fail(`${key} must be an absolute directory on persistent storage.`);
  }
  const { uploads, evidence } = storageDirectories(env);
  validateStorageSeparation(uploads, evidence);
  proxyTrust(env);
}

validateProductionConfig();
