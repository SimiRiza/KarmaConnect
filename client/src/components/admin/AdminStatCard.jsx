import React from 'react';
export default function AdminStatCard({
  label,
  value
}) {
  return <div className="rounded-xl border border-canvas-border bg-white p-5 min-w-0"><p className="text-sm text-stone-600">{label}</p><p className="text-3xl font-bold text-brand-800 mt-2 break-words">{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</p></div>;
}
