import ProjectTrust from '../../components/ProjectTrust';
import ProgressSummary from '../../components/ProgressSummary';
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as csr from '../../services/csrService';
import NGOCredibilityCard from '../../components/NGOCredibilityCard';
import StatusPipeline from '../../components/StatusPipeline';
import FundModal from '../../components/FundModal';
import { Evidence } from '../../components/ReportView';
import { formatMoney } from '../../components/PortfolioSummaryCard';
import { Page, useLoad, panel } from './CSRLayout';
export default function CSREvaluationPage() {
  const {
    id
  } = useParams();
  const {
    data,
    loading,
    error,
    refresh
  } = useLoad(() => csr.detail(id), [id]);
  const [fundOpen, setFundOpen] = useState(false),
    [success, setSuccess] = useState('');
  const p = data?.project;
  return <Page title={p?.title || 'Evaluate project'} error={error} loading={loading}>{p && <><ProjectTrust projectId={id} /><p className="text-stone-600">{[p.location.city, p.location.area].filter(Boolean).join(', ')} · {p.category.replaceAll('_', ' ')}</p><StatusPipeline currentStatus={p.status} />{success && <p role="status" className="bg-brand-50 p-4 rounded-xl">{success} <Link className="underline" to={`/csr/projects/${id}/monitor`}>Monitor project</Link></p>}<div className="grid lg:grid-cols-[1fr_360px] gap-6"><div className="space-y-6"><NGOCredibilityCard ngo={p.ngo} /><section className={panel}><h2 className="text-xl font-bold">Problem and project plan</h2><p className="whitespace-pre-wrap">{p.problemStatement}</p><p className="whitespace-pre-wrap">{p.description}</p><p><strong>{p.beneficiaries.estimatedCount}</strong> estimated beneficiaries · {p.beneficiaries.description}</p><p>Required skills: {p.requiredSkills.join(', ') || 'Not specified'}</p><p>Volunteers needed: {p.volunteersNeeded} · Accepted participants: {p.volunteerParticipation}</p><p>Timeline: {p.timeline?.startDate ? new Date(p.timeline.startDate).toLocaleDateString() : 'Not specified'} to {p.timeline?.expectedEndDate ? new Date(p.timeline.expectedEndDate).toLocaleDateString() : 'Not specified'}</p><h3 className="font-semibold">Milestones</h3>{p.milestones.map(m => <p key={m._id}>{m.completed ? '✓' : '○'} {m.title} {m.targetDate ? `— ${new Date(m.targetDate).toLocaleDateString()}` : ''}</p>)}{!p.milestones.length && <p>No milestones recorded.</p>}</section><section className={panel}><h2 className="text-xl font-bold">Project evidence</h2><Evidence photos={p.photos} /></section></div><aside className={`${panel} self-start`}><h2 className="text-xl font-bold">Project budget (INR)</h2><ProgressSummary projectId={p._id} refreshKey={p.updatedAt} /><p>Unattributed project spending: {formatMoney(p.unattributedSpent)}</p><h3 className="font-semibold">Materials</h3>{p.materialsNeeded.map(m => <p key={m._id}>{m.item}: {m.quantityReceived} received / {m.quantityNeeded} needed</p>)}{!p.materialsNeeded.length && <p>No materials listed.</p>}<p className="text-sm text-stone-500">Item-level prices are not recorded. Funding figures are the NGO's project totals.</p><button disabled={p.status === 'completed' || p.fundingReceived >= p.fundingRequired} onClick={() => setFundOpen(true)} className="w-full bg-accent-500 text-white rounded-xl py-3 px-4 disabled:opacity-50">Fund this project</button>{p.status === 'completed' ? <p>This project is completed.</p> : p.fundingReceived >= p.fundingRequired && <p>This project is fully funded.</p>}<p className="text-sm text-stone-500">Allocations are simulated. No payment is collected.</p></aside></div>{fundOpen && <FundModal project={p} onClose={() => setFundOpen(false)} onSuccess={async () => {
        setFundOpen(false);
        setSuccess('Simulated allocation confirmed.');
        await refresh();
      }} />}</>}</Page>;
}
