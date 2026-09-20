export const normalize = value => typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';
export const distinct = values => [...new Set((Array.isArray(values) ? values : []).map(normalize).filter(Boolean))];
const aliases = {
  'education & literacy': ['education'], 'healthcare & sanitation': ['health', 'cleaning'],
  'environment & climate': ['environment'], 'hunger & food security': ['other'],
  'women empowerment': ['education', 'health'], 'animal welfare': ['animal_welfare'],
  'disaster relief': ['repair', 'health'], 'elderly care': ['elderly_support'],
  'youth development': ['education'], 'community arts & culture': ['other']
};
export const categories = values => [...new Set(distinct(values).flatMap(v => aliases[v] || [v.replaceAll(' ', '_')]))];
export const overlap = (a, b) => distinct(a).filter(v => distinct(b).includes(v));
export const rank = items => items.sort((a, b) => b.matchScore - a.matchScore || (+new Date(b.createdAt || 0) - +new Date(a.createdAt || 0)) || String(a._id).localeCompare(String(b._id)));
export function scored(item, components) {
  return { ...item, matchScore: components.reduce((n, c) => n + c.points, 0), matchBreakdown: components,
    matchReasons: components.filter(c => c.points > 0).map(c => c.reason) };
}
export function inrRange(value) {
  const m = /^INR\s+(\d+)\s*-\s*(\d+)$/i.exec(value || '');
  return m && +m[1] <= +m[2] ? { min: +m[1], max: +m[2] } : null;
}
