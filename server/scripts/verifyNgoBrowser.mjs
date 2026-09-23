// Run manually: node scripts/verifyNgoBrowser.mjs
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
let http, vite, browser, socket, browserProfile;
const files = [];
const artifacts = path.resolve('../artifacts/ngo-browser');
try {
  await connectDB();
  const passwordHash = await bcrypt.hash('BrowserTest123!', 10);
  const make = (name, role) => User.create({
    name,
    role,
    email: `${name}@browser.test`,
    passwordHash,
    isEmailVerified: true,
    location: {
      city: 'Pune'
    }
  });
  const [ngo, community, csr] = await Promise.all([make('NGOBrowser', 'ngo'), make('CommunityBrowser', 'community_user'), make('CSRBrowser', 'csr_manager')]);
  await NGOProfile.create({
    userId: ngo._id,
    ngoName: 'Browser NGO',
    registrationNumber: 'TEST',
    verificationStatus: 'verified'
  });
  await CommunityUserProfile.create({
    userId: community._id,
    subType: 'student',
    skills: ['Gardening'],
    availability: 'Weekends'
  });
  const problem = await Problem.create({
    postedBy: community._id,
    title: 'Restore the neighborhood park',
    description: 'The community needs help restoring its park.',
    category: 'environment',
    location: {
      city: 'Pune',
      area: 'Central'
    },
    urgency: 'high',
    photos: [],
    estimatedResourcesNeeded: 'Plants and gardening tools'
  });
  await Application.create({
    userId: community._id,
    problemId: problem._id,
    contributionType: 'skills',
    relevantSkills: ['Gardening']
  });
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
  browserProfile = await fs.mkdtemp(path.join(os.tmpdir(), 'karmaconnect-browser-'));
  browser = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${browserProfile}`, 'about:blank'], {
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe']
  });
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
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
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
    pending.set(requestId, {
      resolve,
      reject
    });
    socket.send(JSON.stringify({
      id: requestId,
      method,
      params
    }));
  });
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
  await login(ngo.email);
  await wait(text('NGO dashboard'));
  await wait(text('New problems near you'));
  await click('Discover');
  await wait(text('Adopt This Problem'));
  await click('Adopt This Problem');
  await wait(text('Adopt this problem?'));
  await click('Plan project first');
  await wait(text('Adopt and plan your project'));
  await wait("!!document.querySelector('form input')");
  await field('Estimated beneficiaries', '40');
  await field('Funding required', '200');
  await field('Recorded volunteer hours', '6');
  await click('Add material');
  await field('Material 1', 'Plants');
  await field('Quantity needed', '10');
  await click('Add milestone');
  await field('Milestone 1', 'Plant trees');
  await click('Adopt and create project');
  await wait(text('Project overview'));
  await wait(text('Restore the neighborhood park'));
  const project = await Project.findOne({
    sourceProblemId: problem._id
  });
  assert.ok(project);
  assert.equal(project.beneficiaries.estimatedCount, 40);
  assert.equal(project.materialsNeeded[0].item, 'Plants');
  await click('Applicants (1)');
  await wait(text('Accept'));
  await click('Accept');
  await wait(text('Application accepted.'));
  await click('Team');
  await wait(text('CommunityBrowser'));
  await click('Resources');
  await field('Plants:', '4');
  await field('Total funding spent', '50');
  await field('Required note', 'Receipt browser-100');
  await click('Save resources');
  await wait(text('Resources updated.'));
  await wait(text('Receipt browser-100'));
  await click('Move to team forming');
  await wait(text('Move to funding needed'));
  await click('Move to funding needed');
  await wait(text('Move to in progress'));
  await click('Move to in progress');
  await wait(text('Upload at least one after photo.'));
  await click('Photos');
  await evaluate("(() => { const e=document.querySelector('select'); e.value='after'; e.dispatchEvent(new Event('change',{bubbles:true})); })()");
  const uploadFile = path.join(browserProfile, 'after.png');
  await fs.writeFile(uploadFile, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
  const doc = await command('DOM.getDocument');
  const input = await command('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: 'input[type=file]'
  });
  await command('DOM.setFileInputFiles', {
    nodeId: input.nodeId,
    files: [uploadFile]
  });
  await click('Upload photos');
  await wait(text('Photos uploaded.'));
  await wait("[...document.images].some(i => i.alt.startsWith('after photo') && i.complete && i.naturalWidth > 0)");
  const uploadedProject = await Project.findById(project._id);
  files.push(...uploadedProject.photos.after.map(url => path.resolve(process.cwd(), '.' + url)));
  await click('Mark as completed');
  await wait(text('Project completed. Impact statistics updated.'));
  await fs.mkdir(artifacts, {
    recursive: true
  });
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });
  const desktop = await command('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true
  });
  await fs.writeFile(path.join(artifacts, 'project-desktop.png'), Buffer.from(desktop.data, 'base64'));
  await click('Overview');
  await wait(text('NGO dashboard'));
  await wait(text('40'));
  await command('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'Mobile dashboard should not overflow');
  const mobile = await command('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true
  });
  await fs.writeFile(path.join(artifacts, 'dashboard-mobile.png'), Buffer.from(mobile.data, 'base64'));
  await go('/ngo/profile');
  await wait(text('Only an administrator'));
  await field('About the Organisation', 'Verified browser-tested NGO');
  await click('Add Member');
  await fill('input[aria-label="Team member name"]', 'Asha');
  await fill('input[aria-label="Team member role"]', 'Coordinator');
  await click('Save Profile');
  await wait(text('Profile updated successfully!'));
  assert.equal((await NGOProfile.findOne({
    userId: ngo._id
  })).team[0].name, 'Asha');
  await go('/ngo/projects/new');
  await wait(text('Create a project'));
  await wait("!!document.querySelector('form input')");
  await field('Title', 'Direct browser project');
  await field('Description', 'A direct NGO project');
  await field('City', 'Pune');
  await click('Create project');
  await wait(text('Project overview'));
  // Clear only this isolated browser's cookies and verify denied direct routes for other roles.
  for (const account of [community, csr]) {
    await command('Network.clearBrowserCookies');
    await login(account.email);
    await wait("!location.pathname.includes('/login')");
    for (const route of ['/ngo/dashboard', '/ngo/profile', '/ngo/discover-problems', '/ngo/projects', '/ngo/projects/new', `/ngo/projects/${project._id}`]) {
      await go(route);
      await wait(text('Access Restricted'));
    }
  }
  await command('Network.clearBrowserCookies');
  await go('/signup');
  await wait(text('Continue'));
  await click('Continue');
  await wait("!!document.querySelector('input[name=name]')");
  await fill('input[name=name]', 'New Browser Volunteer');
  await fill('input[name=email]', 'new-volunteer@browser.test');
  await fill('input[name=password]', 'BrowserTest123!');
  await fill('input[name=confirmPassword]', 'BrowserTest123!');
  await click('Next: Profile');
  await wait(text('Complete Registration'));
  await field('City / Neighborhood', 'Pune');
  await click('Complete Registration');
  await wait(text('Welcome to KarmaConnect!'));
  const registered = await User.findOne({
    email: 'new-volunteer@browser.test'
  });
  assert.ok(registered);
  await command('Network.clearBrowserCookies');
  await login(registered.email);
  await wait(text('Welcome back,'));
  await go('/post-problem');
  await wait(text('Submit problem'));
  await field('Title', 'Browser community report');
  await field('Description', 'Please help clean the local garden.');
  await field('City', 'Pune');
  const communityDoc = await command('DOM.getDocument');
  const communityInput = await command('DOM.querySelector', {
    nodeId: communityDoc.root.nodeId,
    selector: 'input[type=file]'
  });
  await command('DOM.setFileInputFiles', {
    nodeId: communityInput.nodeId,
    files: [uploadFile]
  });
  await click('Submit problem');
  await wait(text('I Want to Help'));
  const posted = await Problem.findOne({
    title: 'Browser community report'
  });
  assert.ok(posted);
  files.push(...posted.photos.map(url => path.resolve(process.cwd(), '.' + url)));
  await click('I Want to Help');
  await wait(text('Apply to this problem'));
  await click('Submit application');
  await wait(text('You already applied. Status: pending'));
  assert.ok(await Application.exists({
    userId: registered._id,
    problemId: posted._id
  }));
  assert.deepEqual(runtimeErrors, [], 'No uncaught browser runtime errors');
  console.log('PASS: browser adoption/prefill, materials/milestones, application acceptance, resource tracking, multipart photos, completion, direct creation, mobile layout, all NGO route guards, NGO profile edits, and community signup/login/post/apply.');
  console.log('Screenshots: artifacts/ngo-browser/project-desktop.png and dashboard-mobile.png');
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  if (browser) browser.kill();
  if (vite) await vite.close();
  if (http) await new Promise(r => http.close(r));
  await Promise.all(files.map(file => fs.unlink(file).catch(() => {})));
  await disconnectDB();
  // The browser profile is temporary; leave cleanup to the OS if Chrome still holds a lock.
  if (browserProfile && path.resolve(browserProfile).startsWith(path.resolve(os.tmpdir()) + path.sep)) await fs.rm(browserProfile, {
    recursive: true,
    force: true,
    maxRetries: 3
  }).catch(() => {});
}
