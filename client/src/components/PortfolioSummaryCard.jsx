import React from 'react';
export const formatMoney = n => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
}).format(n || 0);
export default function PortfolioSummaryCard({
  summary,
  showBudget = false
}) {
  const items = [['Allocated', formatMoney(summary.totalBudgetAllocated)], ['Spent', formatMoney(summary.totalAmountSpent)], ['Remaining allocation', formatMoney(summary.remaining)], ['Active projects', summary.activeProjectsCount], ['Completed projects', summary.completedProjectsCount], ['NGOs partnered', summary.totalNgosPartnered], ['Volunteer participation', summary.volunteersInvolvedCount], ['Beneficiaries reached', summary.totalBeneficiariesReached]];
  return <section aria-label="Portfolio summary" className="space-y-3">{showBudget && <p className="rounded-xl bg-brand-50 p-4">Company budget range: <strong>{summary.budgetRange || 'Not set'}</strong><span className="block text-sm text-stone-600">A range is not an exact annual budget. All allocation figures below are simulated INR amounts.</span></p>}<dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">{items.map(([label, value]) => <div key={label} className="bg-white border border-stone-200 rounded-2xl p-4"><dt className="text-sm text-stone-600">{label}</dt><dd className="text-2xl font-semibold text-brand-800 mt-2 tabular-nums">{value ?? 0}</dd></div>)}</dl><p className="text-sm text-stone-500">Beneficiaries reached counts completed projects once. Volunteer participation is summed across projects; a person may participate in more than one.</p></section>;
}
