/**
 * FICTIONAL DEMO ONLY: every person, NGO, company, activity and outcome below
 * is invented for a presentation. Locations are real; no affiliation is implied.
 * Run from the repository root: node server/scripts/seedDemoData.js [--clear]
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import User from '../models/User.js';
import CommunityUserProfile from '../models/CommunityUserProfile.js';
import NGOProfile from '../models/NGOProfile.js';
import CSRProfile from '../models/CSRProfile.js';
import Problem from '../models/Problem.js';
import Project from '../models/Project.js';
import Application from '../models/Application.js';
import Team from '../models/Team.js';
import Contribution from '../models/Contribution.js';
import Funding from '../models/Funding.js';
import ImpactRecord from '../models/ImpactRecord.js';
import { calculateProjectProgress, refreshContributionStats, generateImpactRecord } from '../services/impactCalculations.js';
import { recalculateNgoStats } from '../services/ngoStats.js';

export const demoModels = [User, CommunityUserProfile, NGOProfile, CSRProfile, Problem, Project, Application, Team, Contribution, Funding, ImpactRecord];
const PASSWORD = 'Demo@1234';
const domain = 'demo.karmaconnect.test';
const volunteers = [
  ['Anvitha Kiran', 'Hanamkonda', 'student', ['teaching', 'event organizing'], ['education', 'environment']],
  ['Rithvik Madhav', 'Hyderabad', 'working_professional', ['web development', 'graphic design'], ['technology for good', 'education']],
  ['Sahithi Venu', 'Warangal', 'student', ['first aid', 'physical fitness'], ['health', 'elderly support']],
  ['Niharika Teja', 'Subedari', 'general_volunteer', ['cooking', 'event organizing'], ['community welfare']],
  ['Pranav Harin', 'Peddammagadda', 'working_professional', ['electrical work', 'repair'], ['infrastructure', 'safety']],
  ['Vaishnavi Rithu', 'Jangaon', 'student', ['social media management', 'photography'], ['environment', 'awareness campaigns']],
  ['Aditya Nivin', 'Hyderabad', 'working_professional', ['financial planning', 'bookkeeping'], ['transparency', 'NGO support']],
  ['Meghana Tarun', 'Hanamkonda', 'general_volunteer', ['gardening', 'cleaning drives'], ['environment', 'public spaces']],
];
const ngos = [
  ['Kartavya Seva Samithi', ['education', 'child welfare'], ['Hanamkonda', 'Warangal'], 'This fictional grassroots group helps children build reading and digital skills. Volunteers work with neighbourhood schools to create welcoming spaces for learning.', ['Ishani Dev', 'Navin Keshav']],
  ['Prakruti Rural Foundation', ['environment', 'water conservation'], ['Jangaon', 'Peddammagadda'], 'This fictional foundation brings neighbours together to restore shared outdoor spaces. Its volunteers organise practical water conservation workshops and local environmental awareness drives.', ['Tanvi Madhur', 'Vihan Sree']],
  ['Manavata Community Trust', ['elderly support', 'health', 'disaster relief'], ['Subedari', 'Hyderabad'], 'This fictional trust supports older residents through regular visits and community meals. Teams coordinate first aid awareness and repairs to shared community facilities.', ['Dhriti Nayan', 'Arjun Ved']],
];
const companies = [
  ['Trinetra Technologies Pvt Ltd', 'IT', ['education', 'technology access'], '₹5,00,000 - ₹10,00,000', 'Hyderabad', 'Sanjana Vihan'],
  ['Suryodaya Textiles Ltd', 'Manufacturing', ['environment', 'community welfare'], '₹2,00,000 - ₹5,00,000', 'Warangal', 'Rohan Ishir'],
  ['Amrutha Pharma Solutions', 'Healthcare', ['health', 'elderly support'], '₹3,00,000 - ₹7,00,000', 'Hyderabad', 'Kavya Neerav'],
];
// NGO/CSR/member numbers below are zero-based references to the fictional accounts.
const stories = [
  { title: 'Broken streetlights near government school', city: 'Hanamkonda', category: 'repair', urgency: 'high', status: 'reported', description: 'Three streetlights near the school gate need inspection and replacement so families can use the lane safely after dusk.' },
  { title: 'Plastic waste accumulation at Bhadrakali lake', city: 'Warangal', category: 'environment', urgency: 'medium', status: 'team_forming', ngo: 1, members: [5, 7], skills: ['cleaning drives', 'photography'], required: 12000, beneficiaries: 180, description: 'Organise a shoreline clean-up, segregate collected plastic and place awareness signs at the walking path.' },
  { title: 'Computer lab needs setup at ZP High School', city: 'Peddammagadda', category: 'education', urgency: 'medium', status: 'funding_needed', ngo: 0, members: [], skills: ['web development', 'electrical work'], required: 60000, beneficiaries: 120, description: 'Set up refurbished computers, safe power connections and introductory learning software for a school computer lab.' },
  { title: 'Elderly care support needed for isolated seniors', city: 'Subedari', category: 'elderly_support', urgency: 'high', status: 'in_progress', ngo: 2, csr: 2, allocation: 150000, spent: 35000, required: 150000, members: [2, 3, 6], skills: ['first aid', 'cooking', 'bookkeeping'], beneficiaries: 60, description: 'Coordinate weekly meal deliveries, companionship visits and first aid awareness sessions for older residents living alone.', tasks: ['Confirm household visit roster', 'Deliver community meals', 'Prepare next week’s supply list'] },
  { title: 'Cleanliness drive needed at Jangaon bus stand', city: 'Jangaon', category: 'cleaning', urgency: 'low', status: 'reported', description: 'Coordinate a weekend sweeping and litter segregation drive near the bus stand, with gloves and collection sacks for volunteers.' },
  { title: 'Water conservation awareness camp', city: 'Jangaon', category: 'environment', urgency: 'medium', status: 'completed', ngo: 1, csr: 1, allocation: 40000, spent: 45000, required: 45000, members: [0, 5, 7], skills: ['teaching', 'event organizing', 'photography'], beneficiaries: 240, description: 'Run practical demonstrations on rainwater collection, leak checks and household water saving.', outcomes: 'In this fictional camp, 240 residents attended practical water-saving demonstrations. Volunteers contributed 65 hours to preparation, teaching and follow-up. Participants received illustrated guides and practised identifying household leaks; longer-term water savings have not been measured.' },
  { title: 'Digital literacy classes for slum children', city: 'Hyderabad', category: 'education', urgency: 'medium', status: 'in_progress', ngo: 0, csr: 0, allocation: 50000, spent: 20000, required: 80000, members: [0, 1], skills: ['teaching', 'web development', 'graphic design'], beneficiaries: 80, description: 'Provide small-group classes in basic computer use and online safety for children in an underserved neighbourhood.', tasks: ['Prepare introductory lesson cards', 'Teach supervised computer sessions', 'Schedule the next learner assessment'] },
  { title: 'Repair of community hall roof', city: 'Hanamkonda', category: 'repair', urgency: 'high', status: 'completed', ngo: 2, csr: 1, allocation: 120000, spent: 120000, required: 120000, members: [4, 6], skills: ['repair', 'electrical work', 'bookkeeping'], beneficiaries: 500, description: 'Repair damaged roof sheets and guttering so the neighbourhood hall can resume community meetings.', outcomes: 'In this fictional repair project, damaged roof sheets and guttering were replaced and the hall reopened for a community of 500 residents. Volunteers recorded 40 hours supporting the repair team and checking expenses. A final inspection and rainfall check found no remaining leaks in the repaired section.' },
];
const photo = text => `https://placehold.co/600x400?text=${encodeURIComponent(`Fictional demo: ${text}`)}`;
const day = offset => new Date(Date.now() + offset * 86400000);

// Save through Mongoose to retain validation/defaults/hooks, then tag through the
// native collection: strict schemas intentionally have no isSeedData path.
// Both writes share the transaction, so no untagged seed document can commit.
async function insert(Model, data, session) {
  const [doc] = await Model.create([data], { session });
  await Model.collection.updateOne({ _id: doc._id }, { $set: { isSeedData: true } }, { session });
  return doc;
}

export async function seedDemoData({ clear = false, log = console.log } = {}) {
  // A replica set is required: never fall back to partial/destructive writes.
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('Demo seeding requires a MongoDB replica set (including Atlas) for atomic cleanup and insertion.');
  // Prepare collections/indexes before opening a transaction on an empty DB.
  for (const Model of demoModels) await Model.init();
  const passwordHash = clear ? null : await bcrypt.hash(PASSWORD, 12);
  const session = await mongoose.startSession();
  let summary;
  try {
    await session.withTransaction(async () => {
      const accounts = [], walkthrough = [];
      let removed = 0;
      for (const Model of [...demoModels].reverse()) {
        const result = await Model.collection.deleteMany({ isSeedData: true }, { session });
        removed += result.deletedCount;
      }
      if (clear) { summary = { removed, accounts, walkthrough }; return; }
      async function account(name, role, city, handle) {
        const email = `${handle}@${domain}`;
        // Collisions with real accounts abort and restore the previous seed set.
        if (await User.exists({ email }).session(session)) throw new Error(`Refusing to replace an existing non-demo account: ${email}`);
        const user = await insert(User, { name, email, passwordHash, role, isEmailVerified: true, location: { city, state: 'Telangana' } }, session);
        accounts.push({ role, name, email });
        return user;
      }
      const users = [], ngoUsers = [], csrUsers = [];
      for (const [index, [name, city, subType, skills, interests]] of volunteers.entries()) {
        const user = await account(name, 'community_user', city, `volunteer${index + 1}`); users.push(user);
        const causes = [['education', 'environment'], ['education'], ['health', 'elderly_support'], ['elderly_support'], ['repair'], ['environment'], ['education', 'elderly_support'], ['environment', 'cleaning']][index];
        await insert(CommunityUserProfile, { userId: user._id, subType, skills, interests, causeAreas: causes, availability: index % 2 ? 'Weekends, 4 hours' : 'Weekday evenings, 3 hours', bio: `Fictional demo volunteer in ${city}, interested in ${interests.join(' and ')}.`, collegeOrOrganization: subType === 'student' ? 'Fictional Neighbourhood Learning College' : '' }, session);
      }
      for (const [index, [ngoName, causeAreas, locationsServed, about, names]] of ngos.entries()) {
        const user = await account(names[0], 'ngo', locationsServed[0], `ngo${index + 1}`); ngoUsers.push(user);
        // Track records are derived from completed demo projects below, rather
        // than invented historical totals unsupported by project records.
        await insert(NGOProfile, { userId: user._id, ngoName, registrationNumber: `FICTIONAL-DEMO-NGO-${index + 1}`, causeAreas, locationsServed, about, verificationStatus: 'verified', contactPersonName: names[0], team: names.map((name, n) => ({ name, role: n ? 'Volunteer coordinator' : 'Programme lead' })) }, session);
      }
      for (const [index, [companyName, industry, csrFocusAreas, budgetRange, city, name]] of companies.entries()) {
        const user = await account(name, 'csr_manager', city, `csr${index + 1}`); csrUsers.push(user);
        await insert(CSRProfile, { userId: user._id, companyName, csrManagerName: name, industry, csrFocusAreas, budgetRange, verificationStatus: 'verified' }, session);
      }
      for (const [index, story] of stories.entries()) {
        const completed = story.status === 'completed';
        const before = photo(`${story.title} - before`);
        const location = { city: story.city, area: story.city === 'Peddammagadda' ? 'Peddammagadda, Warangal' : story.city === 'Subedari' ? 'Subedari, Hanamkonda' : story.city };
        const problem = await insert(Problem, { postedBy: users[index]._id, title: story.title, description: story.description, category: story.category, location, urgency: story.urgency, status: story.status, photos: [before], estimatedResourcesNeeded: story.required ? `INR ${story.required}; ${story.skills.join(', ')}` : 'Volunteers, inspection and basic safety supplies', createdAt: day(-50) }, session);
        walkthrough.push(`${story.title} — ${story.status}${story.ngo === undefined ? ' — available for adoption' : ` — ${ngos[story.ngo][0]} (ngo${story.ngo + 1}@${domain})`}`);
        if (story.ngo === undefined) continue;
        const ngoId = ngoUsers[story.ngo]._id;
        const project = await insert(Project, { ngoId, sourceProblemId: problem._id, title: story.title, problemStatement: story.description, description: story.description, category: story.category, location, status: story.status, fundingRequired: story.required, beneficiaries: { estimatedCount: story.beneficiaries, description: completed ? 'Residents reached in this fictional demo' : 'Intended residents in this fictional demo' }, requiredSkills: story.skills, volunteersNeeded: Math.max(3, story.members.length), timeline: { startDate: day(-40), expectedEndDate: day(completed ? -5 : 30) }, milestones: ['Needs assessment', 'Community activities', 'Outcome review'].map((title, n) => ({ title, completed: completed || (story.status === 'in_progress' && n === 0), targetDate: day(-35 + n * 15) })), photos: { before: [before], progress: story.status === 'in_progress' ? [photo(`${story.title} - work underway`)] : [], after: completed ? [photo(`${story.title} - after`)] : [] }, outcomesSummary: story.outcomes || '', completedAt: completed ? day(-5) : null, resourceUpdates: story.spent ? [{ note: 'Fictional demo expense total: supplies, transport and programme delivery.', fundingSpent: story.spent, createdAt: day(completed ? -6 : -1) }] : [], createdAt: day(-45) }, session);
        problem.adoptedByNgoId = ngoId; problem.linkedProjectId = project._id; await problem.save({ session });
        for (const n of story.members) await insert(Application, { userId: users[n]._id, problemId: problem._id, contributionType: 'time', relevantSkills: volunteers[n][3], note: 'Available to support this fictional community project.', status: 'accepted', createdAt: day(-42) }, session);
        if (story.members.length) {
          const taskTitles = story.tasks || ['Prepare supplies and volunteer roster', 'Deliver community activities', 'Review outcomes with residents'];
          const team = await insert(Team, { projectId: project._id, name: `${story.city} community team`, status: completed ? 'completed' : story.status === 'team_forming' ? 'forming' : 'active', members: story.members.map(n => ({ userId: users[n]._id, role: 'Volunteer', joinedAt: day(-40) })), tasks: taskTitles.map((title, n) => ({ title, description: 'Fictional demo task agreed with the NGO coordinator.', assignedTo: users[story.members[n % story.members.length]]._id, status: completed ? 'done' : story.status === 'team_forming' ? 'todo' : ['done', 'in_progress', 'todo'][n], dueDate: day(completed ? -7 : n * 3), createdAt: day(-35) })), messages: [{ senderId: ngoId, content: 'Welcome to this fictional demo workspace. Please review your assigned activity.', sentAt: day(-35) }], meetingSchedule: [{ title: completed ? 'Outcome review' : 'Volunteer coordination meeting', dateTime: day(completed ? -5 : 2), notes: 'Fictional demonstration meeting.' }], createdAt: day(-40) }, session);
          project.teamId = team._id; project.teamMembers = team.members.map(m => m.userId); await project.save({ session });
        }
        if (story.csr !== undefined) await insert(Funding, { csrUserId: csrUsers[story.csr]._id, projectId: project._id, amountAllocated: story.allocation, allocationDate: day(-30), notes: 'Fictional simulated CSR allocation; no payment was processed.', idempotencyKey: `fictional-demo-project-${index + 1}` }, session);
        async function contribute(n, type, payload) {
          const field = { time: 'timeContributed', skills: 'skillsContributed', money: 'moneyContributed', materials: 'materialsContributed' }[type];
          return insert(Contribution, { userId: users[n]._id, projectId: project._id, type, [field]: payload, status: 'confirmed', note: 'Fictional demo contribution; monetary entries are simulated.', ...(type === 'materials' ? { reviewedBy: ngoId, reviewedAt: day(-9) } : {}), createdAt: day(completed ? -10 : -2) }, session);
        }
        if (index === 3) {
          await contribute(3, 'time', { hours: 12, description: 'Preparing meals and visiting residents' });
          await contribute(2, 'skills', { skills: ['first aid'], hoursEquivalent: 8, description: 'First aid awareness and visit preparation' });
          await contribute(6, 'skills', { skills: ['bookkeeping'], hoursEquivalent: 4, description: 'Reconciling programme expenses' });
        }
        if (index === 5) {
          await contribute(0, 'skills', { skills: ['teaching', 'event organizing'], hoursEquivalent: 25, description: 'Preparing and teaching water conservation sessions' });
          await contribute(5, 'time', { hours: 20, description: 'Camp preparation and awareness outreach' });
          await contribute(7, 'time', { hours: 20, description: 'Setting up demonstrations and supporting attendees' });
          for (const [n, amount] of [[0, 1500], [5, 1500], [7, 2000]]) await contribute(n, 'money', { amount });
          await contribute(7, 'materials', { items: [{ item: 'Illustrated water-saving guides', quantity: 240 }, { item: 'Rainwater demonstration kits', quantity: 4 }], estimatedValue: 3200 });
          project.materialsNeeded = [{ item: 'Illustrated water-saving guides', quantityNeeded: 240, quantityReceived: 240 }, { item: 'Rainwater demonstration kits', quantityNeeded: 4, quantityReceived: 4 }];
          await project.save({ session });
        }
        if (index === 6) {
          await contribute(0, 'time', { hours: 10, description: 'Small-group learning sessions' });
          await contribute(1, 'skills', { skills: ['web development', 'graphic design'], hoursEquivalent: 14, description: 'Preparing accessible learning resources' });
        }
        if (index === 7) {
          await contribute(4, 'skills', { skills: ['repair', 'electrical work'], hoursEquivalent: 28, description: 'Supporting roof repairs and checking safe connections' });
          await contribute(6, 'time', { hours: 12, description: 'Expense checks and community coordination' });
        }
        if ([1, 2, 6].includes(index)) await insert(Application, { userId: users[index === 1 ? 0 : index === 2 ? 1 : 6]._id, projectId: project._id, contributionType: 'skills', relevantSkills: story.skills.slice(0, 1), note: 'Please consider me for the next volunteer session.', status: 'pending' }, session);
        if (index === 1) await insert(Application, { userId: users[2]._id, projectId: project._id, contributionType: 'time', note: 'Unable to attend the agreed dates.', status: 'rejected' }, session);
        await calculateProjectProgress(project._id, session);
        await refreshContributionStats(project._id, session);
        if (completed) {
          const record = await generateImpactRecord(project._id, session);
          await ImpactRecord.collection.updateOne({ _id: record._id }, { $set: { isSeedData: true } }, { session });
        }
      }
      for (const ngo of ngoUsers) await recalculateNgoStats(ngo._id, session);
      summary = { removed, accounts, walkthrough };
    });
  } finally { await session.endSession(); }
  if (clear) { log(`Cleared ${summary.removed} tagged demo documents. No new data created.`); return summary; }
  log(`Fictional demo ready. Replaced ${summary.removed} previously tagged documents. All monetary entries are simulated.`);
  for (const role of ['community_user', 'ngo', 'csr_manager']) {
    log(`\n${role} accounts (shared password: ${PASSWORD})`);
    for (const a of summary.accounts.filter(a => a.role === role)) log(`  ${a.email} | ${PASSWORD} | ${a.name}`);
  }
  log('\nWalkthrough:'); for (const line of summary.walkthrough) log(`  ${line}`);
  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--clear')) throw new Error('Usage: node server/scripts/seedDemoData.js [--clear]');
  const directory = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(directory, '../.env') });
  dotenv.config({ path: path.resolve(directory, '../../.env') });
  if (process.env.USE_IN_MEMORY_DB === 'true') throw new Error('Set USE_IN_MEMORY_DB=false and configure MONGODB_URI for the same persistent replica-set database used by the app. A separate ephemeral seed database would disappear on exit.');
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/karmaconnect';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    await seedDemoData({ clear: args.includes('--clear') });
  } finally { await mongoose.disconnect(); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    // Do not print a connection string or driver error that may contain secrets.
    const connectionError = /Mongo.*(Selection|Network|Parse|Server)/.test(error.name) && error.code !== 11000;
    console.error(`Demo seed failed; no partial seed transaction was committed. ${connectionError ? 'Check MongoDB connectivity, credentials and replica-set configuration.' : error.message}`);
    process.exitCode = 1;
  });
}
