import { normalize, categories, overlap, rank, scored } from './matchingUtils.js';

export function availabilityFits(availability, project) {
  const value = normalize(availability);
  const start = new Date(project.timeline?.startDate || NaN), end = new Date(project.timeline?.expectedEndDate || NaN);
  const valid = Number.isFinite(+start) && Number.isFinite(+end) && end >= start;
  if (value === 'flexible') return Boolean(project.urgency || valid);
  if (!valid || !['weekdays', 'weekends'].includes(value)) return false;
  for (let day = 0; day <= Math.min(6, Math.floor((end - start) / 86400000)); day++) {
    const weekday = (start.getUTCDay() + day) % 7;
    if (value === 'weekends' ? weekday === 0 || weekday === 6 : weekday > 0 && weekday < 6) return true;
  }
  return false;
}
// Pure: no database access, clock access or mutation of profile/candidates.
export function scoreVolunteerProjects(profile, projects) {
  return rank(projects.map(p => {
    const skills = overlap(profile.skills, p.requiredSkills);
    const interests = overlap(categories(profile.interests), [p.category]);
    const causes = overlap(categories(profile.causeAreas), [p.category]);
    const city = normalize(profile.location?.city);
    return scored(p, [
      { key: 'skills', points: skills.length * 3, reason: `Skills: ${skills.join(', ')}` },
      { key: 'interests', points: interests.length * 2, reason: `Interest: ${interests.join(', ')}` },
      { key: 'location', points: city && city === normalize(p.location?.city) ? 2 : 0, reason: `${p.location?.city} location` },
      { key: 'availability', points: availabilityFits(profile.availability, p) ? 1 : 0, reason: normalize(profile.availability) === 'flexible' ? 'Flexible availability fits the recorded urgency or timeline' : `${profile.availability} occur in the project timeline` },
      { key: 'causes', points: causes.length * 2, reason: `Cause: ${causes.join(', ')}` }
    ]);
  }));
}
