// Run manually: node scripts/verifyTrustBrowser.mjs
// Uses an isolated in-memory replica set, temporary browser profile and test-only accounts.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
process.env.USE_IN_MEMORY_DB = 'true';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
const {
  default: app
} = await import('../server.js');
const {
  connectDB,
  disconnectDB
} = await import('../config/db.js');
const {
  default: User
} = await import('../models/User.js');
const {
  default: NGOProfile
} = await import('../models/NGOProfile.js');
const {
  default: CommunityUserProfile
} = await import('../models/CommunityUserProfile.js');
const {
  default: Problem
} = await import('../models/Problem.js');
const {
  default: Project
} = await import('../models/Project.js');
const {
  default: Application
} = await import('../models/Application.js');
const {
  default: bcrypt
} = await import('bcryptjs');
const {
  createServer
} = await import('../../client/node_modules/vite/dist/node/index.js');
const {
  default: tailwind
} = await import('../../client/node_modules/tailwindcss/lib/index.js');
const {
  default: tailwindConfig
} = await import('../../client/tailwind.config.js');
const {
  default: CSRProfile
} = await import('../models/CSRProfile.js');
const {
  default: Funding
} = await import('../models/Funding.js');
const {
  generateAccessToken
} = await import('../utils/tokenUtils.js');

const { default: Team } = await import('../models/Team.js');
let http, vite; const browsers = [];
async function openBrowser(base) {
  const browserProfile = await fs.mkdtemp(path.join(os.tmpdir(), 'karmaconnect-browser-'));
  const browser = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${browserProfile}`, 'about:blank'], {
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe']
  });
  browsers.push({ browser, browserProfile });
  const devtools = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Browser startup timeout')), 20000);
    browser.on('error', reject);
    browser.stderr.on('data', chunk => {
      const match = chunk.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
  });
  const endpoint = new URL(devtools);
  const targets = await fetch(`http://${endpoint.host}/json/list`).then(r => r.json());
  const socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => socket.addEventListener('open', r, {
    once: true
  }));
  let seq = 0;
  const pending = new Map(),
    runtimeErrors = [];
  socket.addEventListener('message', event => {
    const m = JSON.parse(event.data);
    if (m.id) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') runtimeErrors.push(m.params.exceptionDetails.text + ': ' + (m.params.exceptionDetails.exception?.description || ''));
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++seq;
    const timeout = setTimeout(() => reject(new Error("CDP timeout: " + method)), 20000);
    pending.set(requestId, {
      resolve: value => { clearTimeout(timeout); resolve(value); },
      reject: error => { clearTimeout(timeout); reject(error); }
    });
    socket.send(JSON.stringify({
      id: requestId,
      method,
      params
    }));
  });
  browsers.at(-1).socket = socket;
  await command('Runtime.enable');
  await command('Page.enable');
  const evaluate = async expression => {
    const r = await command('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const wait = async predicate => {
    const end = Date.now() + 35000;
    while (Date.now() < end) {
      if (await evaluate(predicate)) return;
      await new Promise(r => setTimeout(r, 150));
    }
    throw new Error('Browser wait failed: ' + predicate + '\n' + (await evaluate('document.body.innerText')));
  };
  const text = value => `document.body.innerText.includes(${JSON.stringify(value)})`;
  const click = async label => evaluate(`(() => { const element = [...document.querySelectorAll('button,a')].find(e => e.getClientRects().length && e.textContent.trim() === ${JSON.stringify(label)}); if (!element) throw new Error('Control not found: ' + ${JSON.stringify(label)}); element.click(); })()`);
  const fill = async (selector, value) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) throw new Error('Input missing: ' + ${JSON.stringify(selector)}); const proto = e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const field = async (label, value) => evaluate(`(() => { const label = [...document.querySelectorAll('label')].find(e => e.getClientRects().length && e.textContent.trim().startsWith(${JSON.stringify(label)})); const e = label?.querySelector('input,textarea') || label?.parentElement.querySelector('input,textarea'); if (!e) throw new Error('Field missing'); Object.getOwnPropertyDescriptor(e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  const go = async route => {
    await command('Page.navigate', {
      url: base + route
    });
    await wait("document.readyState !== 'loading'");
  };
  const login = async email => {
    await go('/login');
    await wait("!!document.querySelector('input[type=email]')");
    await fill('input[type=email]', email);
    await fill('input[type=password]', 'BrowserTest123!');
    await evaluate("document.querySelector('form').requestSubmit()");
  };

  return { command, evaluate, wait, text, click, fill, field, go, login, runtimeErrors };
}
const { default: Contribution } = await import('../models/Contribution.js');
const { default: ImpactRecord } = await import('../models/ImpactRecord.js');
const { default: Notification } = await import('../models/Notification.js');
const { default: Report } = await import('../models/Report.js');
const { createNotification } = await import('../services/notificationService.js');
const { prepareTrust } = await import('../services/trustService.js');
const { evidenceDirectory } = await import('../middleware/verificationUpload.js');

try {
 await connectDB(); await User.init();
 const passwordHash=await bcrypt.hash('BrowserTest123!',10);
 const make=(name,role)=>User.create({name,role,email:name+'@admin-browser.test',passwordHash,isEmailVerified:true});
 const admin=await make('Admin','admin'),member=await make('Volunteer','community_user'),ngo=await make('Organization','ngo'),csr=await make('Company','csr_manager');
 await CommunityUserProfile.create({userId:member._id,subType:'student'});
 const profile=await NGOProfile.create({userId:ngo._id,ngoName:'Browser NGO',registrationNumber:'TEST'});
 await CSRProfile.create({userId:csr._id,companyName:'Browser Company',csrManagerName:'Manager'});
 const photo=(await fs.readdir(path.resolve('uploads'))).find(n=>/\.(jpg|png)$/i.test(n));
 const project=await Project.create({ngoId:ngo._id,title:'Evidence browser project',description:'Review this community project',category:'education',location:{city:'Pune'},fundingRequired:80000,photos:{before:['/uploads/'+photo],after:['/uploads/'+photo]}});
 const team=await Team.create({projectId:project._id,members:[{userId:member._id}]});await Project.updateOne({_id:project._id},{teamId:team._id,teamMembers:[member._id]});
 const problem=await Problem.create({postedBy:member._id,title:'Browser community problem',description:'A community problem',category:'education',urgency:'medium',location:{city:'Pune'}});
 await Funding.create({csrUserId:csr._id,projectId:project._id,amountAllocated:100,idempotencyKey:'polish-fixture'});
 await Report.create({reportedBy:member._id,targetType:'project',targetId:project._id,reason:'other',description:'Browser report for review'});
   http = app.listen(0, '127.0.0.1');
  await new Promise(r => http.once('listening', r));
  const backend = `http://127.0.0.1:${http.address().port}`;
  vite = await createServer({
    root: path.resolve('../client'),
    configFile: path.resolve('../client/vite.config.js'),
    css: {
      postcss: {
        plugins: [tailwind({
          ...tailwindConfig,
          content: [path.resolve('../client/index.html'), path.resolve('../client/src/**/*.{js,jsx}')]
        })]
      }
    },
    server: {
      host: '127.0.0.1',
      port: 0,
      proxy: {
        '/api': {
          target: backend
        },
        '/uploads': {
          target: backend
        }
      }
    }
  });
  await vite.listen();
  const base = `http://127.0.0.1:${vite.httpServer.address().port}`;


 const b=await openBrowser(base);await b.command('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
 let injected=null;
 app.use((req,res,next)=>{if(injected&&req.path===injected.path){if(injected.mode==='error')return res.status(500).json({message:'Temporary audit failure'});if(injected.mode==='delay')return setTimeout(next,2200);}next();});
 app._router.stack.splice(2,0,app._router.stack.pop());
 const cases=[
 [admin,'/admin/dashboard','/api/admin/stats/overview'],[admin,'/admin/verifications','/api/admin/verifications'],[admin,'/admin/reports','/api/admin/reports'],[admin,'/admin/users','/api/admin/users'],[admin,'/admin/users/'+member.id,'/api/admin/users/'+member.id],[admin,'/admin/categories','/api/admin/categories'],[admin,'/admin/project-verification','/api/admin/projects/pending-verification'],
 [member,'/dashboard','/api/problems'],[member,'/discover','/api/problems'],[member,'/my-applications','/api/users/me/applications'],[member,'/saved','/api/users/me/saved'],[member,'/profile','/api/users/me/profile'],[member,'/problems/'+problem.id,'/api/problems/'+problem.id],[member,'/projects/'+project.id,'/api/projects/'+project.id],[member,'/teams/'+team.id,'/api/teams/'+team.id],[member,'/my-impact','/api/users/me/impact'],[member,'/notifications','/api/notifications'],[member,'/impact-stories','/api/impact-records'],
 [ngo,'/ngo/dashboard','/api/ngo/dashboard-summary'],[ngo,'/ngo/discover-problems','/api/ngo/problems'],[ngo,'/ngo/projects','/api/ngo/projects'],[ngo,'/ngo/profile','/api/ngo/me/profile'],[ngo,'/ngo/projects/'+project.id,'/api/ngo/projects/'+project.id],
 [csr,'/csr/dashboard','/api/csr/dashboard-summary'],[csr,'/csr/discover-projects','/api/csr/projects'],[csr,'/csr/portfolio','/api/csr/fundings'],[csr,'/csr/reports','/api/csr/reports/portfolio'],[csr,'/csr/budget','/api/csr/reports/portfolio'],[csr,'/csr/profile','/api/csr/me/profile'],[csr,'/csr/projects/'+project.id,'/api/csr/projects/'+project.id],[csr,'/csr/projects/'+project.id+'/monitor','/api/csr/projects/'+project.id+'/progress']
 ];
 let current;
 for(const [user,route,endpoint]of cases){
  if(current!==user.id){injected=null;await b.command('Network.clearBrowserCookies');await b.login(user.email);await b.wait('!location.pathname.includes("login")');current=user.id;}
  injected={path:endpoint,mode:'delay'};await b.go(route);await b.wait('/loading/i.test(document.body.innerText)||!!document.querySelector(".animate-spin")');
  injected={path:endpoint,mode:'error'};await b.go(route);await b.wait('!!document.querySelector("[role=alert]")');await b.wait('[...document.querySelectorAll("button")].some(e=>e.textContent.trim()==="Retry")');
  injected=null;await b.click('Retry');await b.wait('!document.querySelector("[role=alert]") && !/loading/i.test(document.body.innerText) && !document.querySelector(".animate-spin")');
  assert(await b.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),route+' overflow');
  console.log('PASS: delayed loading, failure, retry, 375px '+route);
 }

 await Promise.all([Project.deleteMany({}),Problem.deleteMany({}),Funding.deleteMany({}),Report.deleteMany({}),Notification.deleteMany({})]);
 await NGOProfile.updateMany({},{$set:{verificationStatus:'verified'}});await CSRProfile.updateMany({},{$set:{verificationStatus:'verified'}});
 const emptyCases=[
 [admin,'/admin/verifications','No verification requests'],[admin,'/admin/reports','No reports'],[admin,'/admin/project-verification','No projects awaiting'],
 [member,'/dashboard','No recommendations'],[member,'/discover','No'],[member,'/my-applications','No applications'],[member,'/saved','No saved'],[member,'/my-impact','No contributions'],[member,'/notifications','No notifications'],[member,'/impact-stories','No completed stories'],
 [ngo,'/ngo/dashboard','No active projects'],[ngo,'/ngo/discover-problems','No problems match'],[ngo,'/ngo/projects','No projects found'],
 [csr,'/csr/discover-projects','No projects'],[csr,'/csr/portfolio','No funding records'],[csr,'/csr/reports','No current funded projects'],[csr,'/csr/budget','No current allocations']
 ];
 for(const [user,route,message]of emptyCases){if(current!==user.id){await b.command('Network.clearBrowserCookies');await b.login(user.email);await b.wait('!location.pathname.includes("login")');current=user.id;}await b.go(route);await b.wait(b.text(message));assert(!await b.evaluate('!!document.querySelector("[role=alert]")'),route+' empty is successful');console.log('PASS: genuine empty state '+route);}
 await b.go('/');await new Promise(r=>setTimeout(r,2400));
 assert.deepEqual(b.runtimeErrors,[]);
 console.log('PASS: page state audit');
} catch(error){console.error(error);process.exitCode=1;} finally {
  for(const b of browsers){if(b.socket?.readyState===WebSocket.OPEN)b.socket.close();b.browser.kill();}
  if(http)http.closeAllConnections();if(vite)await vite.close();if(http)await new Promise(r=>http.close(r));await disconnectDB();
  for(const b of browsers)if(path.resolve(b.browserProfile).startsWith(path.resolve(os.tmpdir())+path.sep))await fs.rm(b.browserProfile,{recursive:true,force:true,maxRetries:3}).catch(()=>{});
}
