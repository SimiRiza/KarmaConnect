import { normalize, categories, overlap, rank, scored, inrRange } from './matchingUtils.js';

// Pure scoring; budget comparisons use INR fundingRequired, never simulated receipts.
export function scoreCsrProjects(profile, projects) {
  const range = profile.budget || inrRange(profile.budgetRange);
  return rank(projects.map(p => {
    const focus = overlap(categories(profile.csrFocusAreas), [p.category]);
    const location = ['city', 'state'].some(k => normalize(profile.location?.[k]) && normalize(profile.location[k]) === normalize(p.location?.[k]));
    const required = p.fundingRequired;
    const budget = !range || !(required > 0) ? 0 : required >= range.min && required <= range.max ? 2 : required <= range.max * 1.2 ? 1 : 0;
    return scored(p, [
      { key: 'focus', points: focus.length * 3, reason: `${focus.join(', ')} focus` },
      { key: 'location', points: location ? 2 : 0, reason: `Shared location: ${p.location?.city || p.location?.state}` },
      { key: 'budget', points: budget, reason: budget === 2 ? 'Within INR budget range' : 'Partial INR budget fit' },
      { key: 'verified', points: p.ngo?.verificationStatus === 'verified' ? 1 : 0, reason: 'Verified managing NGO' },
      { key: 'trackRecord', points: p.ngo?.previousProjectsCount > 3 ? 0.5 : 0, reason: 'NGO has more than 3 previous projects' }
    ]);
  }));
}
