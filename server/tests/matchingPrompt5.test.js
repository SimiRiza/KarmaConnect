import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreVolunteerProjects, availabilityFits } from '../services/volunteerMatching.js';
import { scoreCsrProjects } from '../services/csrMatching.js';

test('volunteer scoring follows every weight, deduplicates and does not mutate inputs', () => {
  const profile = { skills: [' Teaching ', 'teaching', 'Gardening'], interests: ['Education & Literacy'], causeAreas: ['education'], availability: 'flexible', location: { city: 'PUNE' } };
  const candidates = [
    { _id: '5', category: 'health' },
    { _id: '4', category: 'health', location: { city: 'Pune' } },
    { _id: '3', category: 'education' },
    { _id: '2', category: 'education', requiredSkills: ['Teaching'] },
    { _id: '1', category: 'education', requiredSkills: ['teaching', 'Gardening'], location: { city: 'Pune' }, urgency: 'high' }
  ];
  const before = JSON.stringify({ profile, candidates });
  const result = scoreVolunteerProjects(profile, candidates);
  assert.deepEqual(result.map(p => p.matchScore), [13, 7, 4, 2, 0]);
  assert.deepEqual(result.map(p => p._id), ['1', '2', '3', '4', '5']);
  assert.equal(result[0].matchBreakdown.reduce((n, c) => n + c.points, 0), 13);
  assert.equal(result[0].matchReasons.length, 5);
  assert.equal(JSON.stringify({ profile, candidates }), before);
  assert.equal(scoreVolunteerProjects({}, candidates)[0].matchScore, 0);
});
test('availability requires evidence and weekday/weekend intervals are deterministic', () => {
  const saturday = { timeline: { startDate: '2026-09-19', expectedEndDate: '2026-09-19' } };
  assert.equal(availabilityFits('weekends', saturday), true);
  assert.equal(availabilityFits('weekdays', saturday), false);
  assert.equal(availabilityFits('flexible', {}), false);
  assert.equal(availabilityFits('unknown', { urgency: 'high' }), false);
  assert.equal(availabilityFits('weekdays', { timeline: { startDate: '2026-09-19', expectedEndDate: '2026-09-25' } }), true);
});
test('CSR exact weights, partial budgets, independent track record and stable ties', () => {
  const profile = { csrFocusAreas: ['education'], location: { city: 'Pune' }, budgetRange: 'INR 100-1000' };
  const projects = [
    { _id: '5', category: 'health', fundingRequired: 5000 },
    { _id: '4', category: 'education', fundingRequired: 1201 },
    { _id: '3', category: 'education', fundingRequired: 1200 },
    { _id: '2', category: 'education', fundingRequired: 500, location: { city: 'Pune' } },
    { _id: '1', category: 'education', fundingRequired: 500, location: { city: 'Pune' }, ngo: { verificationStatus: 'verified', previousProjectsCount: 4 } }
  ];
  const before = JSON.stringify(projects);
  assert.deepEqual(scoreCsrProjects(profile, projects).map(p => p.matchScore), [8.5, 7, 4, 3, 0]);
  assert.equal(JSON.stringify(projects), before);
  assert.equal(scoreCsrProjects({}, [{ _id: '1', ngo: { verificationStatus: 'pending', previousProjectsCount: 4 } }])[0].matchScore, 0.5);
  assert.equal(scoreCsrProjects({ budgetRange: '$100-1000' }, [{ fundingRequired: 500 }])[0].matchScore, 0);
  assert.equal(scoreCsrProjects(profile, [{ fundingRequired: 50 }])[0].matchScore, 1);
  assert.deepEqual(scoreCsrProjects({}, [{ _id: 'b' }, { _id: 'a' }]).map(p => p._id), ['a', 'b']);
});
