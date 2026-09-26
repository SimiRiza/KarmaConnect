import React from 'react';
export default function SimpleGrowthChart({
  items = []
}) {
  const max = Math.max(1, ...items.flatMap(p => [p.newUsers, p.newProjects]));
  return <div className="space-y-3" aria-label="Platform growth by UTC period">{items.map(p => <div key={p.start} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 text-sm"><time dateTime={p.start}>{new Date(p.start).toLocaleDateString('en-IN', {
          timeZone: 'UTC'
        })}</time><div><p>{p.newUsers} new users / {p.newProjects} new projects</p><div aria-hidden="true" className="space-y-1 mt-1"><div className="h-2 bg-brand-600 rounded" style={{
            width: p.newUsers / max * 100 + '%'
          }} /><div className="h-2 bg-accent-500 rounded" style={{
            width: p.newProjects / max * 100 + '%'
          }} /></div></div></div>)}</div>;
}
