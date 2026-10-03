import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { uploadsDirectory as directory } from '../config/storage.js';
// In production this directory must be backed by operator-managed persistent storage.
export const upload = multer({
  storage: multer.diskStorage({
    destination: directory,
    filename: (_req, file, cb) => cb(null, `${randomUUID()}.${file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg'}`)
  }),
  limits: {
    files: 6,
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => cb(['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.mimetype) ? null : Object.assign(new Error('Only JPEG, PNG and WEBP images are allowed.'), {
    statusCode: 400
  }), true)
});
export const removeUploads = async (files = []) => Promise.all(files.map(file => fs.promises.unlink(file.path).catch(() => {})));
