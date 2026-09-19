// Run manually: node scripts/verifyCsrBrowser.mjs
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
let http, vite, browser, socket, browserProfile;
const files = [];
const artifacts = path.resolve('../artifacts/csr-browser');
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
  const second = await make('CSRSecondBrowser', 'csr_manager');
  await CSRProfile.create([csr, second].map(u => ({
    userId: u._id,
    companyName: u.name,
    csrManagerName: 'Manager',
    csrFocusAreas: ['education'],
    budgetRange: 'INR 0-10000'
  })));
  await Funding.init();
  const education = await Project.create({
    ngoId: ngo._id,
    title: 'School restoration',
    problemStatement: 'Classrooms need help',
    description: 'Repair classrooms',
    category: 'education',
    location: {
      city: 'Pune'
    },
    beneficiaries: {
      estimatedCount: 40
    },
    fundingRequired: 1000,
    timeline: {
      startDate: '2026-01-01',
      expectedEndDate: '2026-03-01'
    },
    milestones: [{
      title: 'Survey',
      completed: true
    }, {
      title: 'Repair',
      completed: false,
      targetDate: '2026-02-01'
    }]
  });
  await Project.create([{
    ngoId: ngo._id,
    title: 'Plant trees',
    description: 'Green the city',
    category: 'environment',
    location: {
      city: 'Pune'
    },
    fundingRequired: 2000
  }, {
    ngoId: ngo._id,
    title: 'Health camp',
    description: 'Preventative health',
    category: 'health',
    location: {
      city: 'Mumbai'
    },
    fundingRequired: 500
  }]);
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
  await login(csr.email);
  await wait(text('CSR dashboard'));
  await wait(text('Recommended projects'));
  await click('Company profile');
  await wait(text('Save company profile'));
  await field('Industry', 'Technology');
  await field('Company website', 'https://example.org');
  await click('Save company profile');
  await wait(text('Company profile saved.'));
  assert.equal((await CSRProfile.findOne({
    userId: csr._id
  })).industry, 'Technology');
  await click('Discover projects');
  await wait(text('Find matching projects'));
  await fill('input[placeholder="e.g. education, environment"]', 'education');
  await evaluate("document.querySelector('input[placeholder=\"e.g. education, environment\"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
  await field('Location', 'Pune');
  await field('Minimum budget', '500');
  await field('Maximum budget', '1500');
  await field('Maximum months', '3');
  await click('Find matching projects');
  await wait(text('Best matches (1)'));
  await go(`/csr/projects/${education._id}`);
  await wait(text('Fund this project'));
  await click('Fund this project');
  await wait(text('Confirm simulated allocation'));
  await field('Allocation amount', '100');
  await field('Notes (optional)', 'Browser grant');
  await click('Confirm simulated allocation');
  await wait(text('Simulated allocation confirmed.'));
  assert.equal(await Funding.countDocuments({
    csrUserId: csr._id
  }), 1);
  await click('Fund this project');
  await wait(text('Confirm simulated allocation'));
  await field('Allocation amount', '50');
  await click('Confirm simulated allocation');
  await wait("!document.querySelector('dialog[open]')");
  await go('/csr/portfolio');
  await wait(text('Withdraw allocation'));
  // Confirm only this test's simulated withdrawal dialog.
  await evaluate('window.confirm = () => true');
  await click('Withdraw allocation');
  await wait(text('Allocation withdrawn.'));
  const retained = await Funding.findOne({
    csrUserId: csr._id,
    status: {
      $ne: 'withdrawn'
    }
  });
  assert.equal(retained.amountAllocated, 100);
  const secondToken = generateAccessToken(second);
  const secondResponse = await fetch(`${backend}/api/csr/projects/${education._id}/fund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secondToken}`,
      'Idempotency-Key': 'browser-second-allocation'
    },
    body: JSON.stringify({
      amountAllocated: 200
    })
  });
  assert.equal(secondResponse.status, 201);
  const ngoToken = generateAccessToken(ngo);
  const update = await fetch(`${backend}/api/ngo/projects/${education._id}/resources`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ngoToken}`
    },
    body: JSON.stringify({
      fundingSpent: 150,
      receiptNote: 'CSR browser receipt for school supplies'
    })
  });
  assert.equal(update.status, 200);
  await go(`/csr/projects/${education._id}/monitor`);
  await wait(text('Your attributed spend'));
  await wait(text('CSR browser receipt for school supplies'));
  await wait(text('Overdue milestone: Repair'));
  const record = await Funding.findById(retained._id);
  assert.equal(record.amountSpentSoFar, 100);
  await go(`/csr/reports?project=${education._id}`);
  await wait(text('CSR IMPACT REPORT'));
  await wait(text('Work is ongoing'));
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });
  await fs.mkdir(artifacts, {
    recursive: true
  });
  const reportScreenshot = await command('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true
  });
  await fs.writeFile(path.join(artifacts, 'report-desktop.png'), Buffer.from(reportScreenshot.data, 'base64'));
  await click('Budget');
  await wait(text('Allocation breakdown by project'));
  await wait(text('School restoration'));
  await click('Overview');
  await wait(text('CSR dashboard'));
  await wait(text('Recommended projects'));
  await command('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'CSR mobile dashboard should not overflow');
  const mobileScreenshot = await command('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true
  });
  await fs.writeFile(path.join(artifacts, 'dashboard-mobile.png'), Buffer.from(mobileScreenshot.data, 'base64'));
  for (const account of [ngo, community]) {
    await command('Network.clearBrowserCookies');
    await login(account.email);
    await wait("!location.pathname.includes('/login')");
    for (const route of ['/csr/dashboard', '/csr/profile', '/csr/discover-projects', '/csr/portfolio', '/csr/budget', '/csr/reports', `/csr/projects/${education._id}`, `/csr/projects/${education._id}/monitor`]) {
      await go(route);
      await wait(text('Access Restricted'));
    }
  }
  assert.deepEqual(runtimeErrors, [], 'No uncaught browser errors');
  console.log('PASS: CSR company profile, matching, evaluation, simulated allocations, withdrawal, multi-funder spending, monitoring, reports, budget, responsive dashboard, and all CSR role guards.');
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
