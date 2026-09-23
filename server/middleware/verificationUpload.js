import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
export const evidenceDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.local/verification-evidence');
const extensions = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const parser = multer({ storage: multer.memoryStorage(), limits: { files: 4, fileSize: 5 * 1024 * 1024, fields: 2 }, fileFilter: (_req,file,cb) => cb(extensions[file.mimetype] ? null : Object.assign(new Error('Choose PDF, JPEG, PNG or WebP documents.'), { statusCode: 400 }), true) }).array('documents',4);
export const cleanEvidenceFiles = files => Promise.all((files || []).filter(f=>f.path).map(f=>fs.promises.unlink(f.path).catch(()=>{})));
export function verificationUpload(req,res,next) {
 parser(req,res,async error => {
  if (error) return next(Object.assign(error,{ statusCode:400 }));
  try {
   for (const file of req.files || []) {
    const b=file.buffer, mime=file.mimetype;
    const valid = mime==='application/pdf' ? b.subarray(0,5).toString()==='%PDF-' : mime==='image/png' ? b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : mime==='image/jpeg' ? b[0]===255 && b[1]===216 && b[2]===255 : b.subarray(0,4).toString()==='RIFF' && b.subarray(8,12).toString()==='WEBP';
    if (!valid) throw Object.assign(new Error('Document content does not match its file type.'),{statusCode:400});
   }
   await fs.promises.mkdir(evidenceDirectory,{recursive:true});
   for (const file of req.files || []) { file.filename=randomUUID()+'.'+extensions[file.mimetype]; file.path=path.join(evidenceDirectory,file.filename); await fs.promises.writeFile(file.path,file.buffer,{flag:'wx'}); delete file.buffer; }
   next();
  } catch(err) { await cleanEvidenceFiles(req.files); next(err); }
 });
}
