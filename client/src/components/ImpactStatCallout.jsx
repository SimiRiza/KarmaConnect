import React from 'react';
export default function ImpactStatCallout({ label, value }) { return <div className="rounded-2xl bg-white border border-brand-100 p-5"><p className="text-3xl font-bold text-brand-800 break-words">{value}</p><p className="mt-2 text-stone-600">{label}</p></div>; }
