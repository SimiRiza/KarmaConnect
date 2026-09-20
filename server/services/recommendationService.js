import Project from '../models/Project.js';
import Problem from '../models/Problem.js';
import User from '../models/User.js';
import CommunityUserProfile from '../models/CommunityUserProfile.js';
import CSRProfile from '../models/CSRProfile.js';
import { scoreVolunteerProjects } from './volunteerMatching.js';
import { scoreCsrProjects } from './csrMatching.js';
import { normalize, distinct, inrRange } from './matchingUtils.js';
import { fail } from './fundingService.js';
import { discoverProjects, focusCategories } from './csrService.js';

export function pagination(query = {}, defaultLimit = 10) {
  const limit = Number(query.limit ?? defaultLimit), page = Number(query.page ?? 1);
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(page) || page < 1) fail('Page and limit must be positive integers.');
  return { limit: Math.min(50, limit), page: Math.min(100000, page) };
}
const paged = (items, query, matching = true) => {
  const { limit, page } = pagination(query);
  return { items: items.slice((page - 1) * limit, page * limit), total: items.length, page, totalPages: Math.ceil(items.length / limit), matching };
};
export async function volunteerRecommendations(userId, query) {
  const user = await User.findById(userId).select('location.city').lean();
  const profile = await CommunityUserProfile.findOne({ userId }).lean();
  const projects = await Project.find({ status: { $ne: 'completed' } }).select('title description category location.city location.area requiredSkills timeline status photos fundingRequired fundingReceived fundingSpent sourceProblemId createdAt').populate('sourceProblemId', 'urgency').lean();
  const problems = await Problem.find({ status: { $ne: 'completed' }, linkedProjectId: null }).select('title description category location.city location.area urgency status photos createdAt').lean();
  const candidates = [...projects.map(p => ({ ...p, targetType: 'project', urgency: p.sourceProblemId?.urgency || null })), ...problems.map(p => ({ ...p, targetType: 'problem' }))];
  return paged(scoreVolunteerProjects({ ...profile, location: user?.location }, candidates), query);
}
export async function csrRecommendations(userId, query = {}, overrides) {
  const user = await User.findById(userId).select('location.city location.state').lean();
  const profile = await CSRProfile.findOne({ userId }).lean();
  if (!profile) fail('CSR profile not found.', 404);
  const preferences = { ...profile, location: user?.location };
  const filters = { ...(overrides || {}), page: 1, limit: 50 };
  if (overrides) {
    if (overrides.focusAreas !== undefined) { focusCategories(overrides.focusAreas); preferences.csrFocusAreas = overrides.focusAreas; }
    if (overrides.location) { if (typeof overrides.location !== 'string') fail('Invalid location.'); preferences.location = { city: overrides.location, state: overrides.location }; }
    if (overrides.budgetMin !== undefined && overrides.budgetMin !== '' || overrides.budgetMax !== undefined && overrides.budgetMax !== '') {
      const min = Number(overrides.budgetMin || 0), max = Number(overrides.budgetMax || 0);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) fail('Invalid budget range.');
      preferences.budget = { min, max };
    }
  }
  delete filters.focusAreas; delete filters.location; delete filters.budgetMin; delete filters.budgetMax;
  // Shared discovery validates explicit non-preference constraints. Score ALL candidates before paging.
  const candidates = await discoverProjects(filters, true);
  const result = paged(scoreCsrProjects(preferences, candidates.items.filter(p => p.status !== 'completed')), { ...query, ...(overrides || {}) });
  return { ...result, recommendationNote: preferences.budget || inrRange(profile.budgetRange) ? 'Ranked by focus, location, INR budget fit and NGO track record.' : 'Ranked by focus, location and NGO track record. Set an INR budget range to score budget fit.' };
}
export async function skillMatches(userId, query) {
  const profile = await CommunityUserProfile.findOne({ userId }).select('skills').lean();
  const skills = distinct(profile?.skills);
  const projects = await Project.find({ status: { $ne: 'completed' }, 'skillRequests.status': 'open' }).select('title location.city skillRequests').lean();
  const items = projects.flatMap(p => p.skillRequests.filter(r => r.status === 'open').flatMap(r => {
    const skill = normalize(r.skillNeeded), matchedSkills = skills.filter(s => s.includes(skill) || skill.includes(s));
    return skill && matchedSkills.length ? [{ ...r, projectId: p._id, projectTitle: p.title, location: p.location, matchedSkills }] : [];
  })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || String(a._id).localeCompare(String(b._id)));
  return paged(items, query);
}
