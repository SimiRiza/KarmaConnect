import React from 'react';
export default function BeforeAfterComparison({ before = [], after = [] }) {
  return <div className="grid md:grid-cols-2 gap-5">{[['Before', before], ['After', after]].map(([label, photos]) => <section key={label} className="space-y-3"><h3 className="text-xl font-bold">{label}</h3>{photos.length ? photos.map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`${label} project evidence ${i + 1}`} className="w-full aspect-[4/3] object-cover rounded-2xl mb-3" /></a>) : <div className="rounded-2xl border border-dashed p-12 text-stone-500">No {label.toLowerCase()} photo recorded.</div>}</section>)}</div>;
}
