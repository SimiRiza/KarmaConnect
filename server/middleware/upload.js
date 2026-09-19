import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
const directory = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(directory, {
  recursive: true
});
// Local storage is intentionally swappable for S3/Cloudinary in a later prompt.
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
