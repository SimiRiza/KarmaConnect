import * as admin from '../services/adminService.js';
import { Router } from 'express';
import path from 'node:path';
import { authenticate, authorize } from '../middleware/auth.js';
import { endpoint } from '../controllers/teamController.js';
import { verificationUpload, cleanEvidenceFiles, evidenceDirectory } from '../middleware/verificationUpload.js';
import { validId, fail } from '../services/resourceValidation.js';
import * as trust from '../services/trustService.js';
export const adminRoutes = Router(); adminRoutes.use(authenticate, authorize('admin'));
adminRoutes.post('/create-admin', endpoint(r=>admin.createAdmin(r.body)));
adminRoutes.get('/stats/overview', endpoint(()=>admin.overview()));
adminRoutes.get('/stats/growth', endpoint(r=>admin.growth(r.query)));
adminRoutes.get('/categories', endpoint(()=>admin.categories()));
adminRoutes.get('/users', endpoint(r=>admin.usersList(r.query)));
adminRoutes.get('/users/:id', endpoint(r=>admin.userDetail(r.params.id)));
adminRoutes.patch('/users/:id/suspend', endpoint(r=>admin.suspendUser(r.user.id,r.params.id,true)));
adminRoutes.patch('/users/:id/reactivate', endpoint(r=>admin.suspendUser(r.user.id,r.params.id,false)));
adminRoutes.get('/verifications', endpoint(r=>admin.verifications(r.query)));
adminRoutes.get('/reports/:id', endpoint(r=>admin.reportDetail(r.params.id)));
adminRoutes.get('/projects/pending-verification', endpoint(r=>admin.evidenceQueue(r.query)));
adminRoutes.get('/verifications/pending', endpoint(r=>trust.pendingVerifications(r.query)));
adminRoutes.patch('/verifications/:profileType/:profileId', endpoint(r=>trust.reviewVerification(r.user.id,r.params.profileType,r.params.profileId,r.body)));
adminRoutes.patch('/projects/:id/verify-evidence', endpoint(r=>trust.verifyEvidence(r.params.id)));
adminRoutes.get('/reports', endpoint(r=>trust.listReports(r.query)));
adminRoutes.patch('/reports/:id', endpoint(r=>trust.reviewReport(r.user.id,r.params.id,r.body)));
export const trustRoutes = Router(); trustRoutes.use(authenticate);
trustRoutes.post('/reports', endpoint(r=>trust.createReport(r.user.id,r.body)));
trustRoutes.get('/projects/:id/trust', endpoint(r=>trust.projectTrust(r.params.id)));
for (const [type,role] of [['ngo','ngo'],['csr','csr_manager']]) {
 trustRoutes.get('/'+type+'/me/verification-evidence', authorize(role), endpoint(r=>trust.ownEvidence(r.user.id,type)));
 trustRoutes.post('/'+type+'/me/verification-evidence', authorize(role), verificationUpload, async (req,res,next)=> {
  try { const result = await trust.addEvidence(req.user.id,type,req.body.type,req.files); res.status(201).json({success:true,...result}); }
  catch(error) { await cleanEvidenceFiles(req.files); next(error); }
 });
}
trustRoutes.get('/verification-evidence/:type/:id/:filename', async (req,res,next)=> {
 try {
  if (!/^[a-f0-9-]+\.(pdf|png|jpg|webp)$/.test(req.params.filename)) fail('Document not found.',404);
  const profile=await trust.profileModel(req.params.type).findById(validId(req.params.id)).select('+verificationEvidence');
  if (!profile) fail('Document not found.',404);
  if (req.user.role!=='admin' && String(profile.userId)!==req.user.id) fail('Access denied.',403);
  const url='/api/verification-evidence/'+req.params.type+'/'+req.params.id+'/'+req.params.filename;
  if (!profile.verificationEvidence.some(e=>e.url===url)) fail('Document not found.',404);
  res.set('Cache-Control','no-store'); res.set('X-Content-Type-Options','nosniff');
  res.download(path.join(evidenceDirectory,req.params.filename),req.params.filename,error=>{if(error && !res.headersSent) next(Object.assign(new Error('Document unavailable.'),{statusCode:404}));});
 } catch(error) { next(error); }
});
