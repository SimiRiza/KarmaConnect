import React from 'react';
export default function MatchScoreBadge({ project }) {
  if (!Number.isFinite(project.matchScore)) return null;
  return <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900"><strong>{project.matchScore} match points</strong><p className="mt-1">{project.matchReasons?.length ? `Matches: ${project.matchReasons.join(' · ')}` : 'No profile overlaps yet. Update your preferences to improve recommendations.'}</p></div>;
}
