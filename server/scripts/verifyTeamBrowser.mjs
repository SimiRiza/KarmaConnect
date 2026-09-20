// Run manually: node scripts/verifyTeamBrowser.mjs
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
    const end = Date.now() + 15000;
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
    await wait("document.readyState === 'complete'");
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
try {
  await connectDB(); await Team.init(); await Application.init(); await Project.init();
  const passwordHash = await bcrypt.hash('BrowserTest123!', 10);
  const make = (name, role) => User.create({ name, role, email: name + '@team-browser.test', passwordHash, isEmailVerified: true, location: { city: 'Pune' } });
  const ngo = await make('TeamNGO', 'ngo'), member = await make('TeamVolunteer', 'community_user');
  await NGOProfile.create({ userId: ngo._id, ngoName: 'Learning NGO', registrationNumber: 'TEAM-BROWSER', verificationStatus: 'verified' });
  await CommunityUserProfile.create({ userId: member._id, subType: 'student', skills: ['Teaching', 'Web Development'], interests: ['education'], causeAreas: ['education'], availability: 'flexible' });
  const project = await Project.create({ ngoId: ngo._id, title: 'Community learning project', description: 'Build learning resources together.', category: 'education', location: { city: 'Pune' }, requiredSkills: ['Teaching'], fundingRequired: 1000 });
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

  const owner = await openBrowser(base), volunteer = await openBrowser(base);
  console.log('Browser sessions ready');
  await owner.login(ngo.email); await owner.wait(owner.text('NGO dashboard'));
  await owner.go('/ngo/projects/' + project._id); await owner.wait(owner.text('Post a skill request'));
  await owner.click('Post a skill request'); await owner.field('Skill needed', 'Web'); await owner.field('Hours needed', '10'); await owner.field('Request description', 'Create our learning website'); await owner.click('Publish skill request'); await owner.wait(owner.text('Create our learning website'));
  await volunteer.login(member.email); await volunteer.wait(volunteer.text('Recommended for You'));
  await volunteer.wait(volunteer.text('Your matching skills: web development')); await volunteer.wait(volunteer.text('9 match points'));
  await volunteer.go('/projects/' + project._id); await volunteer.wait(volunteer.text('I want to help')); await volunteer.click('I want to help');
  await volunteer.evaluate("document.querySelector('form').requestSubmit()"); await volunteer.wait(volunteer.text('Application submitted.'));
  await owner.go('/ngo/projects/' + project._id); await owner.wait(owner.text('Applicants (1)')); await owner.click('Applicants (1)'); await owner.wait(owner.text('Accept')); await owner.click('Accept'); await owner.wait(owner.text('Application accepted.'));
  await owner.click('Team'); await owner.wait(owner.text('Open team workspace')); await owner.click('Open team workspace'); await owner.wait(owner.text('TeamVolunteer'));
  const team = await Team.findOne({ projectId: project._id }); assert.ok(team);
  await volunteer.go('/my-applications'); await volunteer.wait(volunteer.text('Open team workspace')); await volunteer.click('Open team workspace'); await volunteer.wait(volunteer.text('Team workspace'));
  await owner.click('Tasks'); await owner.field('New task title', 'Prepare web lesson'); await owner.click('Create task'); await owner.wait(owner.text('Prepare web lesson'));
  const select = async (b, label, value) => b.evaluate('(() => { const e = document.querySelector(' + JSON.stringify('[aria-label="' + label + '"]') + '); e.value = ' + JSON.stringify(value) + '; e.dispatchEvent(new Event("change", {bubbles:true})); })()');
  await select(owner, 'Assignee for Prepare web lesson', String(member._id));
  await owner.wait('!document.querySelector("select").disabled');
  await select(owner, 'Status for Prepare web lesson', 'in_progress'); await owner.wait(owner.text('In Progress (1)'));
  await volunteer.click('Tasks'); await volunteer.wait(volunteer.text('Prepare web lesson')); await select(volunteer, 'Status for Prepare web lesson', 'done'); await volunteer.wait(volunteer.text('Done (1)'));
  await owner.click('Schedule a meeting'); await owner.field('Meeting title', 'Learning kickoff'); await owner.field('Meeting date and time', '2030-01-01T10:00'); await owner.field('Meeting notes', 'Bring lesson ideas'); await owner.click('Save meeting'); await owner.wait(owner.text('Learning kickoff'));
  await Team.updateOne({ _id: team._id }, { $push: { messages: { $each: Array.from({ length: 60 }, (_, i) => ({ senderId: ngo._id, content: 'Earlier team update ' + i, sentAt: new Date(Date.now() - 600000 + i * 1000) })) } } });
  await owner.click('Messages'); await volunteer.click('Messages'); await volunteer.wait(volunteer.text('Team conversation'));
  await volunteer.wait(volunteer.text('Load older messages')); await volunteer.click('Load older messages'); await volunteer.wait(volunteer.text('Earlier team update 0'));
  await owner.field('Message', 'Welcome to our learning team'); await owner.click('Send message');
  const started = Date.now(); await volunteer.wait(volunteer.text('Welcome to our learning team')); assert.ok(Date.now() - started < 14000, 'Messages arrive within one polling interval plus network time');
  await volunteer.field('Message', 'Ready to help with the website'); await volunteer.click('Send message'); await owner.wait(owner.text('Ready to help with the website'));
  await Team.updateOne({ _id: team._id }, { $push: { messages: { $each: Array.from({ length: 65 }, (_, i) => ({ senderId: ngo._id, content: 'Busy interval update ' + i, sentAt: new Date() })) } } });
  await volunteer.wait(volunteer.text('Busy interval update 64')); await volunteer.wait(volunteer.text('Busy interval update 0'));
  const artifacts = path.resolve('../artifacts/team-browser'); await fs.mkdir(artifacts, { recursive: true });
  await owner.command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await fs.writeFile(path.join(artifacts, 'workspace-desktop.png'), Buffer.from((await owner.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  await volunteer.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.ok(await volunteer.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'Mobile workspace has no horizontal overflow');
  await fs.writeFile(path.join(artifacts, 'workspace-mobile.png'), Buffer.from((await volunteer.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  await owner.click('Members'); await owner.field('Role', 'Coordinator'); await owner.click('Save role'); await owner.wait(owner.text('Coordinator'));
  await owner.evaluate('window.confirm = () => true'); await owner.click('Remove member'); await owner.wait(owner.text('No current members'));
  await volunteer.wait(volunteer.text('You no longer have access'));
  const stored = await Project.findById(project._id); assert.equal(stored.teamMembers.length, 0); assert.equal((await Team.findById(team._id)).members.length, 0);
  assert.deepEqual(owner.runtimeErrors, []); assert.deepEqual(volunteer.runtimeErrors, []);
  console.log('PASS: real scored volunteer recommendations, skill requests, application/acceptance/team links, tasks, meetings, two isolated logged-in sessions exchanging polled messages, role edits, confirmed removal, revoked access and mobile workspace.');
} catch (error) { console.error(error); process.exitCode = 1; } finally {
  for (const b of browsers) { if (b.socket?.readyState === WebSocket.OPEN) b.socket.close(); b.browser.kill(); }
  if (http) http.closeAllConnections(); if (vite) await vite.close(); if (http) await new Promise(r => http.close(r)); await disconnectDB();
  for (const b of browsers) if (path.resolve(b.browserProfile).startsWith(path.resolve(os.tmpdir()) + path.sep)) await fs.rm(b.browserProfile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
}
