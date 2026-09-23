import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import app from '../server.js';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import NGOProfile from '../models/NGOProfile.js';
import CSRProfile from '../models/CSRProfile.js';
import CommunityUserProfile from '../models/CommunityUserProfile.js';
import Project from '../models/Project.js';
import Problem from '../models/Problem.js';
import Team from '../models/Team.js';
import Application from '../models/Application.js';
import Contribution from '../models/Contribution.js';
import Funding from '../models/Funding.js';
import ImpactRecord from '../models/ImpactRecord.js';
import Notification from '../models/Notification.js';
import Report from '../models/Report.js';
import { generateAccessToken } from '../utils/tokenUtils.js';
import { createNotification } from '../services/notificationService.js';
import { prepareTrust } from '../services/trustService.js';
import { evidenceDirectory } from '../middleware/verificationUpload.js';
import { strictTransaction } from '../utils/strictTransaction.js';
import { mutate } from '../services/teamService.js';
const users={},tokens={},ownedFiles=[];
const api=(method,url,who='member')=>request(app)[method](url).set('Authorization','Bearer '+tokens[who]);
const count=(type,who)=>Notification.countDocuments({type,...(who?{userId:users[who]._id}:{})});
let ngo,csr;
async function project(extra={}) {
 const p=await Project.create({ngoId:users.ngo._id,title:'Community learning',description:'Learning sessions',category:'education',location:{city:'Warangal'},fundingRequired:80000,status:'in_progress',beneficiaries:{estimatedCount:20},photos:{before:['/uploads/before.jpg'],after:['/uploads/after.jpg']},...extra});
 const team=await Team.create({projectId:p._id,members:[{userId:users.member._id},{userId:users.other._id}]});
 await Project.updateOne({_id:p._id},{teamId:team._id,teamMembers:team.members.map(m=>m.userId)});return {p,team};
}
describe('Prompt 7 trust, reporting and transactional notifications',()=>{
 before(async()=>{
  process.env.NODE_ENV='test';process.env.USE_IN_MEMORY_DB='true';await connectDB();
  for(const [name,role]of [['member','community_user'],['other','community_user'],['ngo','ngo'],['csr','csr_manager'],['admin','admin']]){users[name]=await User.create({name,role,email:name+'@trust.test',passwordHash:'test-only',isEmailVerified:true});tokens[name]=generateAccessToken(users[name]);}
  ngo=await NGOProfile.create({userId:users.ngo._id,ngoName:'Learning NGO',registrationNumber:'TEST',verificationStatus:'verified'});
  csr=await CSRProfile.create({userId:users.csr._id,companyName:'Learning Company',csrManagerName:'Manager'});
  await CommunityUserProfile.create({userId:users.member._id,subType:'student',skills:['Teaching']});
  for(const Model of [Project,Problem,Team,Application,Contribution,Funding,ImpactRecord,Notification,Report])await Model.init();
 });
 beforeEach(async()=>{for(const Model of [Notification,Report,Application,Contribution,Funding,ImpactRecord,Team,Project,Problem])await Model.deleteMany({});await NGOProfile.updateOne({_id:ngo._id},{$set:{verificationStatus:'verified',verificationEvidence:[]}});await CSRProfile.updateOne({_id:csr._id},{$set:{verificationStatus:'pending',verificationEvidence:[]}});});
 after(async()=>{for(const file of ownedFiles)await fs.unlink(file).catch(()=>{});await disconnectDB();});
 test('notifications are owned, paginated and persist read/unread/delete; report type is admin only',async()=>{
  for(let i=0;i<3;i++)await createNotification({userId:users.member._id,type:'project_update',title:'Update '+i,message:'Changed'});
  const list=await api('get','/api/notifications?limit=2');assert.equal(list.status,200);assert.equal(list.body.items.length,2);assert.equal(list.body.total,3);
  const id=list.body.items[0]._id;
  assert.equal((await api('patch','/api/notifications/'+id+'/read','other').send({})).status,404);
  assert.equal((await api('patch','/api/notifications/'+id+'/read').send({})).status,200);
  assert.equal((await api('get','/api/notifications?isRead=true')).body.total,1);
  assert.equal((await api('patch','/api/notifications/'+id+'/read').send({isRead:false})).status,200);
  assert.equal((await api('get','/api/notifications/unread-count')).body.count,3);
  await api('patch','/api/notifications/mark-all-read').send({});assert.equal((await api('get','/api/notifications/unread-count')).body.count,0);
  assert.equal((await api('delete','/api/notifications/'+id,'other')).status,404);await api('delete','/api/notifications/'+id);assert.equal(await Notification.countDocuments(),2);
  assert.equal((await api('get','/api/notifications?isRead=anything')).status,400);
  await assert.rejects(createNotification({userId:users.member._id,type:'report_received',title:'No',message:'No'}));
 });
 test('direct and adopted applications notify NGO; acceptance/rejection notify applicants once',async()=>{
  const {p}=await project();
  let r=await api('post','/api/projects/'+p._id+'/apply').send({contributionType:'time'});assert.equal(r.status,200,r.text);
  let id=r.body.application._id;assert.equal(await count('new_volunteer_application','ngo'),1);
  for(let i=0;i<2;i++){r=await api('patch','/api/ngo/applications/'+id,'ngo').send({status:'accepted'});assert.equal(r.status,200,r.text);}assert.equal(await count('application_accepted','member'),1);
  const problem=await Problem.create({urgency:'medium',postedBy:users.member._id,title:'School support',description:'Help school',category:'education',location:{city:'Warangal'},status:'in_progress',adoptedByNgoId:users.ngo._id,linkedProjectId:p._id});
  p.sourceProblemId=problem._id;await p.save();
  r=await api('post','/api/problems/'+problem._id+'/apply','other').send({contributionType:'time'});assert.equal(r.status,201,r.text);
  id=r.body.application._id;for(let i=0;i<2;i++)assert.equal((await api('patch','/api/ngo/applications/'+id,'ngo').send({status:'rejected'})).status,200);
  assert.equal(await count('new_volunteer_application','ngo'),2);assert.equal(await count('application_rejected','other'),1);
 });
 test('CSR allocation, status change, withdrawal and completion notify correct recipients without retry duplicates',async()=>{
  const {p}=await project({status:'adopted'}),key=randomUUID();
  const fund=()=>api('post','/api/csr/projects/'+p._id+'/fund','csr').set('Idempotency-Key',key).send({amountAllocated:100});
  const f=await fund();assert.equal(f.status,201,f.text);await fund();assert.equal(await count('csr_interest','ngo'),1);
  let r=await api('patch','/api/csr/fundings/'+f.body.funding._id+'/withdraw','csr').send({});assert.equal(r.status,200,r.text);assert.equal(await count('project_update','csr'),1);
  const allocation=await api('post','/api/csr/projects/'+p._id+'/fund','csr').set('Idempotency-Key',randomUUID()).send({amountAllocated:200});assert.equal(allocation.status,201);
  p.status='in_progress';await p.save();
  r=await api('patch','/api/ngo/projects/'+p._id+'/resources','ngo').send({fundingSpent:50,receiptNote:'Supplies'});assert.equal(r.status,200,r.text);assert.equal(await count('project_update','csr'),2);
  for(let i=0;i<2;i++){r=await api('post','/api/ngo/projects/'+p._id+'/complete','ngo').send({});assert.equal(r.status,200,r.text);}
  assert.equal(await count('project_completed'),4);for(const who of ['member','other','ngo','csr'])assert.equal(await count('project_completed',who),1);assert.equal(await count('project_update','csr'),3);
 });
 test('contribution recording and confirmation events follow automatic and reviewed transitions',async()=>{
  const {p}=await project(),key=randomUUID(),cash={type:'money',moneyContributed:{amount:100}};
  const give=(data,k=key)=>api('post','/api/projects/'+p._id+'/contributions').set('Idempotency-Key',k).send(data);
  let r=await give(cash);assert.equal(r.status,200,r.text);await give(cash);
  assert.equal(await count('contribution_recorded','member'),1);assert.equal(await count('contribution_confirmed','member'),1);assert.equal(await count('new_contribution','ngo'),1);
  r=await give({type:'materials',materialsContributed:{items:[{item:'Books',quantity:3}],estimatedValue:50}},randomUUID());assert.equal(r.status,200,r.text);
  for(let i=0;i<2;i++)assert.equal((await api('patch','/api/projects/'+p._id+'/contributions/'+r.body.contribution._id+'/confirm','ngo').send({status:'confirmed'})).status,200);
  assert.equal(await count('contribution_confirmed','member'),2);
 });
 test('ten concurrent messages are throttled; a later message notifies again; skill matching works',async()=>{
  const {p,team}=await project();
  await Promise.all(Array.from({length:10},(_,i)=>mutate(users.member.id,team.id,'message',null,{content:'Message '+i})));
  assert.equal(await count('new_team_message','member'),0);assert.equal(await count('new_team_message','other'),1);assert.equal(await count('new_team_message','ngo'),1);
  await Notification.collection.updateMany({type:'new_team_message'},{$set:{createdAt:new Date(Date.now()-61000)}});
  await mutate(users.member.id,team.id,'message',null,{content:'Later message'});assert.equal(await count('new_team_message','other'),2);
  const r=await api('post','/api/ngo/projects/'+p._id+'/skill-requests','ngo').send({skillNeeded:'teaching',hoursNeeded:3,description:'Support lessons'});assert.equal(r.status,200,r.text);
  assert.equal(await count('skill_request_match','member'),1);assert.equal(await count('skill_request_match','other'),0);
 });
 test('milestone reminders are due-soon only and repeated/concurrent checks deduplicate',async()=>{
  await project({milestones:[{title:'Soon',targetDate:new Date(Date.now()+3600000)},{title:'Done',completed:true,targetDate:new Date(Date.now()+3600000)},{title:'Far away',targetDate:new Date(Date.now()+72*3600000)}]});
  const rs=await Promise.all([api('get','/api/notifications/unread-count','ngo'),api('get','/api/notifications/unread-count','ngo')]);for(const r of rs)assert.equal(r.status,200,r.text);assert.equal(await count('milestone_reminder','ngo'),1);
 });
 test('private NGO and CSR evidence upload, pending review, internal notes and status notifications',async()=>{
  for(const [type,who]of [['ngo','ngo'],['csr','csr']]){
   let r=await api('post','/api/'+type+'/me/verification-evidence',who).field('type','registration_doc').attach('documents',Buffer.from('%PDF-1.4\nDemo test document\n%%EOF'),{filename:'registration.pdf',contentType:'application/pdf'});
   assert.equal(r.status,201,r.text);const profile=r.body.profile,e=profile.verificationEvidence[0];ownedFiles.push(path.join(evidenceDirectory,e.url.split('/').at(-1)));assert.equal(profile.verificationStatus,'pending');
   assert.equal((await api('get',e.url,who)).status,200);assert.equal((await api('get',e.url,'admin')).status,200);assert.equal((await api('get',e.url,'member')).status,403);
   const pending=await api('get','/api/admin/verifications/pending','admin');assert.equal(pending.status,200);assert(pending.body.items.some(p=>p._id===profile._id&&p.verificationEvidence.length));
   r=await api('patch','/api/admin/verifications/'+type+'/'+profile._id,'admin').send({verificationStatus:'verified',verificationNotes:'Private review note'});assert.equal(r.status,200,r.text);
   assert.equal(r.body.profile.verificationNotes,'Private review note');assert.equal(r.body.profile.verificationReviewedBy,users.admin.id);
   const own=await api('get','/api/'+type+'/me/profile',who);assert.equal(own.status,200);assert(!JSON.stringify(own.body).includes('Private review note'));
   assert.equal((await api('get','/api/'+type+'/me/verification-evidence',who)).body.profile.verificationStatus,'verified');
   assert(await count('verification_status_changed',who)>=1);
  }
  assert.equal((await api('post','/api/ngo/me/verification-evidence','ngo').field('type','other').attach('documents',Buffer.from('fake pdf'),{filename:'fake.pdf',contentType:'application/pdf'})).status,400);
  assert.equal((await api('post','/api/ngo/me/verification-evidence','member').field('type','other')).status,403);
 });
 test('invalid or failed evidence uploads leave no files and oversized files reject',async()=>{
  const before=await fs.readdir(evidenceDirectory).catch(()=>[]);
  let r=await api('post','/api/ngo/me/verification-evidence','ngo').field('type','unknown').attach('documents',Buffer.from('%PDF-valid-header'),{filename:'valid.pdf',contentType:'application/pdf'});assert.equal(r.status,400,r.text);
  r=await api('post','/api/ngo/me/verification-evidence','ngo').field('type','other').attach('documents',Buffer.alloc(5*1024*1024+1),{filename:'large.pdf',contentType:'application/pdf'});assert.equal(r.status,400,r.text);
  const original=NGOProfile.findOne;
  NGOProfile.findOne=function(){throw new Error('Injected evidence failure');};
  try{r=await api('post','/api/ngo/me/verification-evidence','ngo').field('type','other').attach('documents',Buffer.from('%PDF-valid-header'),{filename:'valid.pdf',contentType:'application/pdf'});assert.equal(r.status,500);}finally{NGOProfile.findOne=original;}
  assert.deepEqual((await fs.readdir(evidenceDirectory)).sort(),before.sort());
 });
 test('notification failure rolls back the business action, not just the alert',async()=>{
  const {p}=await project();const original=Notification.findOneAndUpdate;
  Notification.findOneAndUpdate=()=>{throw new Error('Injected notification failure');};
  try{const r=await api('post','/api/projects/'+p._id+'/apply').send({contributionType:'time'});assert.equal(r.status,500);}finally{Notification.findOneAndUpdate=original;}
  assert.equal(await Application.countDocuments(),0);assert.equal(await Notification.countDocuments(),0);
 });
 test('reports validate every target and admin review flags only supported targets',async()=>{
  const {p}=await project(),problem=await Problem.create({urgency:'medium',postedBy:users.member._id,title:'Litter',description:'Clean street',category:'cleaning',location:{city:'Warangal'}});
  for(const [targetType,targetId]of [['problem',problem.id],['project',p.id],['user',users.other.id],['ngo',ngo.id],['csr_profile',csr.id]]){
   const r=await api('post','/api/reports').send({targetType,targetId,reason:'misleading_information',description:'Please review the supporting evidence.'});assert.equal(r.status,200,r.text);
   assert.equal((await api('post','/api/reports').send({targetType,targetId:new mongoose.Types.ObjectId(),reason:'other',description:'Missing target'})).status,404);
   if(targetType==='project'){const review=await api('patch','/api/admin/reports/'+r.body.report._id,'admin').send({status:'action_taken',reviewNotes:'Flag for investigation',flagTarget:true});assert.equal(review.status,200,review.text);assert.equal((await Project.findById(p._id)).isFlagged,true);}
  }
  assert.equal(await count('report_received','admin'),5);
  const list=await api('get','/api/admin/reports','admin');assert.equal(list.body.items[0].status,'pending');assert.equal(list.body.items.at(-1).status,'action_taken');
  assert.equal((await api('post','/api/reports').send({targetType:'ngo',targetId:p.id,reason:'other',description:'Wrong collection'})).status,404);
 });
 test('all admin paths reject every non-admin role and unauthenticated callers',async()=>{
  const id=new mongoose.Types.ObjectId();for(const [method,url]of [['get','/api/admin/verifications/pending'],['patch','/api/admin/verifications/ngo/'+id],['patch','/api/admin/projects/'+id+'/verify-evidence'],['get','/api/admin/reports'],['patch','/api/admin/reports/'+id],['get','/api/admin/unknown']]){
   for(const who of ['member','ngo','csr'])assert.equal((await api(method,url,who)).status,403);
   assert.equal((await request(app)[method](url)).status,401);
  }
 });
 test('threshold derives on create/edit/backfill and evidence verification invalidates after photo changes',async()=>{
  for(const [required,expected]of [[49999,false],[50000,false],[50001,true]]){const {p}=await project({fundingRequired:required});assert.equal(p.requiresAuthorityApproval,expected);}
  const {p}=await project();let r=await api('put','/api/ngo/projects/'+p._id,'ngo').send({fundingRequired:100});assert.equal(r.status,200,r.text);assert.equal((await Project.findById(p._id)).requiresAuthorityApproval,false);
  assert.equal((await api('put','/api/ngo/projects/'+p._id,'ngo').send({evidenceVerified:true})).status,400);
  assert.equal((await api('patch','/api/admin/projects/'+p._id+'/verify-evidence','admin').send({})).status,200);assert.equal((await Project.findById(p._id)).evidenceVerified,true);
  r=await api('post','/api/ngo/projects/'+p._id+'/photos','ngo').send({category:'before',urls:['/uploads/new.jpg']});assert.equal(r.status,200,r.text);assert.equal((await Project.findById(p._id)).evidenceVerified,false);
  process.env.LARGE_PROJECT_THRESHOLD='50';await prepareTrust();assert.equal((await Project.findById(p._id)).requiresAuthorityApproval,true);delete process.env.LARGE_PROJECT_THRESHOLD;
 });
 test('rolled-back notifications never commit and backfills do not broadcast historical events',async()=>{
  await assert.rejects(strictTransaction(async session=>{await createNotification({userId:users.member._id,type:'project_update',title:'Rollback',message:'Never visible'},{session,key:'rollback'});throw new Error('Injected failure');}));assert.equal(await Notification.countDocuments(),0);
  await project();await prepareTrust();await prepareTrust();assert.equal(await Notification.countDocuments(),0);
 });
});
