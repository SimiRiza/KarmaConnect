import React from 'react';
export const STATUSES = ['reported', 'adopted', 'team_forming', 'funding_needed', 'in_progress', 'completed'];
const colors = {
  reported: 'bg-yellow-100 border-yellow-500 text-yellow-900',
  adopted: 'bg-teal-100 border-teal-500 text-teal-900',
  team_forming: 'bg-blue-100 border-blue-500 text-blue-900',
  funding_needed: 'bg-orange-100 border-orange-500 text-orange-900',
  in_progress: 'bg-purple-100 border-purple-500 text-purple-900',
  completed: 'bg-green-100 border-green-500 text-green-900'
};
export default function StatusPipeline({
  currentStatus
}) {
  const active = STATUSES.indexOf(currentStatus);
  return <ol aria-label="Project status pipeline" className="flex gap-2 overflow-x-auto py-3">{STATUSES.map((status, i) => <li key={status} aria-current={i === active ? 'step' : undefined} className={`shrink-0 border rounded-xl px-3 py-2 text-xs ${i <= active ? colors[status] : 'text-stone-500 border-stone-200'} ${i === active ? 'font-bold ring-2 ring-offset-1 ring-stone-400' : ''}`}>{i < active ? '✓ ' : ''}{status.replaceAll('_', ' ')}</li>)}</ol>;
}
