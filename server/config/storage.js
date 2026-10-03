import fs from 'node:fs';
import { storageDirectories, validateStorageSeparation } from './environment.js';

const directories = storageDirectories();
export const uploadsDirectory = directories.uploads;
export const evidenceDirectory = directories.evidence;

fs.mkdirSync(uploadsDirectory, { recursive: true });
if (process.env.NODE_ENV === 'production') {
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  // Also reject overlapping mount/symlink targets before serving public files.
  validateStorageSeparation(fs.realpathSync(uploadsDirectory), fs.realpathSync(evidenceDirectory));
  for (const directory of [uploadsDirectory, evidenceDirectory]) {
    fs.accessSync(directory, fs.constants.R_OK | fs.constants.W_OK);
  }
}
