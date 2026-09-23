// Run manually: node scripts/verifyImpactBrowser.mjs
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
    const end = Date.now() + 30000;
    while (Date.now() < end) {
      if (await evaluate(predicate)) return;
      await new Promise(r => setTimeout(r, 150));
    }
    throw new Error('Browser wait failed: ' + predicate + '\n' + (await evaluate('document.body.innerText')));
  };
  const text = value => `document.body.innerText.includes(${JSON.stringify(value)})`;
  const click = async label => evaluate(`(() => { const element = [...document.querySelectorAll('button,a')].find(e => e.textContent.trim() === ${JSON.stringify(label)}); if (!element) throw new Error('Control not found: ' + ${JSON.stringify(label)}); element.click(); })()`);
  const fill = async (selector, value) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) throw new Error('Input missing: ' + ${JSON.stringify(selector)}); const proto = e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const field = async (label, value) => evaluate(`(() => { const label = [...document.querySelectorAll('label')].find(e => e.textContent.trim().startsWith(${JSON.stringify(label)})); const e = label?.querySelector('input,textarea') || label?.parentElement.querySelector('input,textarea'); if (!e) throw new Error('Field missing'); Object.getOwnPropertyDescriptor(e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
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
try {
  await connectDB(); await Promise.all([Team.init(), Contribution.init(), ImpactRecord.init(), Funding.init()]);
  const passwordHash = await bcrypt.hash('BrowserTest123!', 10);
  const make = (name, role) => User.create({ name, role, email: name + '@impact-browser.test', passwordHash, isEmailVerified: true, location: { city: 'Pune' } });
  const ngo = await make('ImpactNGO', 'ngo'), member = await make('ImpactVolunteer', 'community_user'), csr = await make('ImpactCSR', 'csr_manager');
  await NGOProfile.create({ userId: ngo._id, ngoName: 'Learning Together NGO', registrationNumber: 'IMPACT-BROWSER', verificationStatus: 'verified' });
  await CommunityUserProfile.create({ userId: member._id, subType: 'student', skills: ['Teaching'], interests: ['education'], availability: 'flexible' });
  await CSRProfile.create({ userId: csr._id, companyName: 'Community Learning Company', csrManagerName: 'Manager', csrFocusAreas: ['education'], budgetRange: 'INR 0-10000' });
  const photo = (await fs.readdir(path.resolve('uploads'))).find(name => /\.(jpg|png)$/i.test(name));
  assert.ok(photo, 'Existing local evidence image available for isolated browser fixture');
  const project = await Project.create({ ngoId: ngo._id, title: 'A brighter place to learn', description: 'The neighborhood classroom needed repair and new learning materials.', category: 'education', location: { city: 'Pune', area: 'Central' }, requiredSkills: ['Teaching'], fundingRequired: 1000, status: 'in_progress', beneficiaries: { estimatedCount: 24 }, photos: { before: ['/uploads/' + photo], after: ['/uploads/' + photo] }, milestones: [{ title: 'Classroom prepared', completed: true }, { title: 'Learning session delivered', completed: false }] });
  const team = await Team.create({ projectId: project._id, members: [{ userId: member._id, role: 'Volunteer' }] }); await Project.updateOne({ _id: project._id }, { teamId: team._id, teamMembers: [member._id] });
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


  const volunteer = await openBrowser(base), owner = await openBrowser(base);
  await volunteer.login(member.email); await volunteer.wait(volunteer.text('Your recorded impact'));
  await volunteer.go('/projects/' + project._id); await volunteer.wait(volunteer.text('Record a contribution'));
  const choose = async (b, value) => b.evaluate('(() => { const e = document.querySelector("dialog select"); e.value = ' + JSON.stringify(value) + '; e.dispatchEvent(new Event("change", {bubbles:true})); })()');
  const contribute = async (type, fields, pending = false) => {
    await volunteer.click('Record a contribution'); await volunteer.wait('!!document.querySelector("dialog[open]")'); await choose(volunteer, type);
    for (const [name, value] of fields) await volunteer.field(name, value);
    await volunteer.click('Submit contribution'); await volunteer.wait('!document.querySelector("dialog[open]")');
    await volunteer.wait(volunteer.text(pending ? 'Awaiting NGO confirmation' : 'Contribution confirmed'));
  };
  await contribute('time', [['Hours contributed','2.5'], ['What did you contribute?','Tutored local learners']]);
  await contribute('skills', [['Equivalent hours','3'], ['Skills used','Teaching, Design'], ['What did you contribute?','Prepared inclusive learning materials']]);
  await contribute('money', [['Simulated amount','200']]);
  await contribute('materials', [['Material item','Books'], ['Quantity','5'], ['Estimated material value','100']], true);
  assert.equal(await Contribution.countDocuments({ projectId: project._id }), 4);
  await owner.login(ngo.email); await owner.wait(owner.text('NGO dashboard')); await owner.go('/ngo/projects/' + project._id); await owner.wait(owner.text('Resources')); await owner.click('Resources'); await owner.wait(owner.text('Confirm contribution')); await owner.click('Confirm contribution'); await owner.wait(owner.text('No contributions awaiting confirmation'));
  await owner.field('Total funding spent', '100'); await owner.field('Required note', 'Receipt for learning supplies'); await owner.click('Save resources'); await owner.wait(owner.text('Resources updated.'));
  await owner.click('Edit project'); await owner.field('Outcomes summary', 'Twenty-four learners now have a welcoming classroom and five new books. Volunteers delivered accessible lessons and prepared reusable materials.'); await owner.click('Save project'); await owner.wait(owner.text('Project saved.'));
  await volunteer.go('/my-impact'); await volunteer.wait(volunteer.text('Contribution timeline')); await volunteer.wait(volunteer.text('5.5')); await volunteer.wait(volunteer.text('books: 5')); await volunteer.wait(volunteer.text('Tutored local learners'));
  const token = generateAccessToken(csr);
  const funded = await fetch(backend + '/api/csr/projects/' + project._id + '/fund', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': 'impact-browser-csr-allocation' }, body: JSON.stringify({ amountAllocated: 300 }) }); assert.equal(funded.status, 201);
  const summaries = [];
  for (const account of [member, ngo, csr]) { const response = await fetch(backend + '/api/projects/' + project._id + '/progress-summary', { headers: { Authorization: 'Bearer ' + generateAccessToken(account) } }); summaries.push(await response.json()); }
  assert.deepEqual(summaries[0], summaries[1]); assert.deepEqual(summaries[1], summaries[2]); assert.equal(summaries[0].funding.total, 500);
  await owner.click('Mark as completed'); await owner.wait(owner.text('Project completed.')); const snapshot = await ImpactRecord.findOne({ projectId: project._id }); assert.equal(snapshot.totalVolunteerHours, 5.5); assert.equal(snapshot.totalMoneyRaised, 500); assert.equal(snapshot.totalMaterialsContributed[0].quantity, 5);
  await volunteer.go('/impact-stories'); await volunteer.wait(volunteer.text('Read impact story')); await volunteer.evaluate("[...document.querySelectorAll('a')].find(e => e.textContent.includes('Read impact story')).click()"); await volunteer.wait(volunteer.text('Before & after')); await volunteer.wait(volunteer.text('Twenty-four learners')); await volunteer.wait(volunteer.text('Community Learning Company'));
  const artifacts = path.resolve('../artifacts/impact-browser'); await fs.mkdir(artifacts, { recursive: true });
  await volunteer.command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await fs.writeFile(path.join(artifacts, 'story-desktop.png'), Buffer.from((await volunteer.command('Page.captureScreenshot', { format:'png', captureBeyondViewport:true })).data,'base64'));
  await volunteer.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); assert.ok(await volunteer.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'Impact story mobile overflow');
  await fs.writeFile(path.join(artifacts, 'story-mobile.png'), Buffer.from((await volunteer.command('Page.captureScreenshot', { format:'png', captureBeyondViewport:true })).data,'base64'));
  await owner.command('Network.clearBrowserCookies'); await owner.login(csr.email); await owner.wait(owner.text('CSR dashboard')); await owner.go('/csr/reports?project=' + project._id); await owner.wait(owner.text('CSR IMPACT REPORT')); await owner.wait(owner.text('Unified money raised')); await owner.wait(owner.text('View the completion impact story'));
  assert.deepEqual(owner.runtimeErrors, []); assert.deepEqual(volunteer.runtimeErrors, []);
  console.log('PASS: four contribution forms, NGO materials confirmation, expense receipts, NGO outcomes/completion, personal impact timeline, identical role summaries, unified CSR report and responsive Impact Stories.');
} catch (error) { console.error(error); process.exitCode = 1; } finally {
  for (const b of browsers) { if (b.socket?.readyState === WebSocket.OPEN) b.socket.close(); b.browser.kill(); }
  if (http) http.closeAllConnections(); if (vite) await vite.close(); if (http) await new Promise(r => http.close(r)); await disconnectDB();
  for (const b of browsers) if (path.resolve(b.browserProfile).startsWith(path.resolve(os.tmpdir()) + path.sep)) await fs.rm(b.browserProfile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
}
