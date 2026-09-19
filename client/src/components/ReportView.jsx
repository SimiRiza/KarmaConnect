import React from 'react';
import NGOCredibilityCard from './NGOCredibilityCard';
import FundingProgressBar from './FundingProgressBar';
import StatusPipeline from './StatusPipeline';
import { formatMoney } from './PortfolioSummaryCard';
export function FundingShare({
  funding
}) {
  return <dl className="grid sm:grid-cols-3 gap-4 bg-brand-50 rounded-xl p-4">{[['Your allocation', funding.allocated], ['Your attributed spend', funding.spent], ['Your remaining allocation', funding.remaining]].map(([label, value]) => <div key={label}><dt className="text-sm text-stone-600">{label}</dt><dd className="text-xl font-semibold">{formatMoney(value)}</dd></div>)}</dl>;
}
export function Evidence({
  photos
}) {
  return <div className="space-y-5">{['before', 'progress', 'after'].map(stage => <section key={stage}><h3 className="font-semibold capitalize mb-2">{stage}</h3><div className="grid sm:grid-cols-3 gap-3">{(photos?.[stage] || []).map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer"><img className="w-full h-40 object-cover rounded-xl" src={url} alt={`${stage} evidence ${i + 1}`} /></a>)}</div>{!photos?.[stage]?.length && <p className="text-stone-500">No {stage} evidence recorded.</p>}</section>)}</div>;
}
export default function ReportView({
  report
}) {
  const p = report.project;
  return <article className="bg-white border rounded-2xl p-6 md:p-8 space-y-6"><header className="border-b pb-5"><p className="text-sm text-brand-700 font-semibold uppercase tracking-wider">CSR impact report · Simulated funding</p><h2 className="text-3xl font-bold mt-2">{p.title}</h2><p className="text-stone-600 mt-2">{p.location.city} · Generated {new Date(report.generatedAt).toLocaleString()}</p></header><StatusPipeline currentStatus={p.status} /><NGOCredibilityCard ngo={p.ngo} /><p>{p.problemStatement || p.description}</p><h3 className="text-xl font-bold">Your funding contribution</h3><FundingShare funding={report.funding} /><h3 className="text-xl font-bold">Project-wide funding (INR)</h3><FundingProgressBar required={p.fundingRequired} received={p.fundingReceived} spent={p.fundingSpent} /><p>Spending not attributed to CSR allocations: {formatMoney(p.unattributedSpent)}</p><div className="grid sm:grid-cols-3 gap-4"><p><strong>{report.beneficiariesReached}</strong> beneficiaries reached</p><p><strong>{report.estimatedBeneficiaries}</strong> estimated beneficiaries</p><p><strong>{report.volunteerParticipation}</strong> volunteer participants</p></div><h3 className="text-xl font-bold">Outcomes</h3><p>{report.outcomesSummary}</p><h3 className="font-bold">Completed activities / milestones</h3>{report.completedMilestones.length ? <ul className="list-disc pl-5">{report.completedMilestones.map(m => <li key={m._id}>{m.title}</li>)}</ul> : <p>No milestones marked complete.</p>}{report.scheduleWarnings.map(w => <p key={w} className="bg-amber-50 text-amber-900 p-3 rounded-xl">{w}</p>)}<Evidence photos={p.photos} /><p className="text-sm text-stone-500">This report reflects current project records. Downloadable PDF/export will be added in a future update.</p></article>;
}
