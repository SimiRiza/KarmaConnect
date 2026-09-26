import EmptyState from '../../components/EmptyState';
import React from 'react';
import { Link } from 'react-router-dom';
import * as csr from '../../services/csrService';
import PortfolioSummaryCard, { formatMoney } from '../../components/PortfolioSummaryCard';
import CSRProjectCard from '../../components/CSRProjectCard';
import { Page, useLoad, panel } from './CSRLayout';
export default function CSRDashboardPage() {
  const {
    data,
    error,
    loading
  } = useLoad(async () => { const [dashboard, recommendations] = await Promise.all([csr.dashboard(), csr.recommendations()]); return { data: { summary: { ...dashboard.data.summary, recommendedProjects: recommendations.data.items, recommendationNote: recommendations.data.recommendationNote } } }; });
  const s = data?.summary;
  return <Page title="CSR dashboard" error={error} loading={loading}>{s && <><PortfolioSummaryCard summary={s} showBudget /><section className="space-y-4"><h2 className="text-2xl font-bold">Recommended projects</h2><p className="text-stone-600">{s.recommendationNote}</p><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{s.recommendedProjects.map(p => <CSRProjectCard key={p._id} project={p} />)}</div>{!s.recommendedProjects.length && <p>No projects match your preferences. <Link className="underline" to="/csr/discover-projects">Adjust filters</Link>.</p>}</section><section className={panel}><h2 className="text-2xl font-bold">My active fundings</h2>{s.activeFundings.map(f => <div className="flex flex-wrap justify-between gap-3 border-b pb-3" key={f._id}><Link className="font-semibold text-brand-800" to={`/csr/projects/${f.projectId?._id}/monitor`}>{f.projectId?.title || 'Project unavailable'}</Link><span>{formatMoney(f.amountAllocated)} · {f.status.replaceAll('_', ' ')}</span></div>)}{!s.activeFundings.length && <EmptyState title="No active allocations yet." message="Recorded activity will appear here." />}</section><section className={panel}><h2 className="text-2xl font-bold">Recent project activity</h2><p className="text-sm text-stone-500">Project update times are shown; individual photos and milestones have no separate event timestamps.</p>{s.recentActivity.map(a => <article key={a.projectId} className="border-b pb-3 space-y-1"><Link className="font-semibold text-brand-800" to={`/csr/projects/${a.projectId}/monitor`}>{a.title}</Link><p>Last updated {new Date(a.updatedAt).toLocaleString()} · {a.photoCount} evidence photos</p><p>Completed milestones: {a.completedMilestones.join(', ') || 'None yet'}</p>{a.latestResourceUpdate && <p>Resource note: {a.latestResourceUpdate.note}</p>}</article>)}{!s.recentActivity.length && <p>No funded project activity yet.</p>}</section></>}</Page>;
}
