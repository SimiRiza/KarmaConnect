import React from 'react';
const fmt = n => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
}).format(n);
export default function FundingProgressBar({
  required = 0,
  received = 0,
  spent = 0
}) {
  const pct = required > 0 ? Math.min(100, received / required * 100) : 0;
  return <div className="space-y-3"><div role="progressbar" aria-label="Funding collected" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className="h-3 bg-stone-200 rounded-full overflow-hidden"><div className="h-full bg-brand-600 rounded-full" style={{
        width: `${pct}%`
      }} /></div><dl className="grid grid-cols-2 gap-2 text-sm">{[['Required', required], ['Collected', received], ['Spent', spent], ['Remaining balance', received - spent], ['Funding shortfall', Math.max(0, required - received)]].map(([label, value]) => <div key={label}><dt className="text-stone-600">{label}</dt><dd className="font-semibold">{fmt(value)}</dd></div>)}</dl></div>;
}
