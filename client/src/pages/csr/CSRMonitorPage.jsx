import EmptyState from '../../components/EmptyState';
import ProgressSummary from '../../components/ProgressSummary';
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import * as csr from '../../services/csrService';
import StatusPipeline from '../../components/StatusPipeline';
import { Evidence, FundingShare } from '../../components/ReportView';
import { formatMoney } from '../../components/PortfolioSummaryCard';
import { Page, useLoad, panel } from './CSRLayout';
export default function CSRMonitorPage() {
  const {
    id
  } = useParams();
  const {
    data,
    loading,
    error
  } = useLoad(() => csr.progress(id), [id]);
  const p = data?.project;
  return <Page title={p ? `Monitor: ${p.title}` : 'Project monitoring'} error={error} loading={loading}>{p && <><StatusPipeline currentStatus={p.status} /><FundingShare funding={data.funding} /><section className={panel}><h2 className="text-xl font-bold">Schedule and issues</h2>{data.scheduleWarnings.length ? data.scheduleWarnings.map(w => <p key={w} className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900">{w}</p>) : <p>No overdue milestones or end date recorded.</p>}<p className="text-sm text-stone-500">{data.issueLogNote}</p></section><div className="grid md:grid-cols-2 gap-5"><section className={panel}><h2 className="text-xl font-bold">Milestone checklist</h2>{p.milestones.map(m => <p key={m._id}><span aria-label={m.completed ? 'Completed' : 'Pending'}>{m.completed ? '✓' : '○'}</span> {m.title} · {m.targetDate ? new Date(m.targetDate).toLocaleDateString() : 'No target date'}</p>)}{!p.milestones.length && <EmptyState title="No milestones recorded." message="Recorded activity will appear here."/>}</section><section className={panel}><h2 className="text-xl font-bold">All project funding</h2><ProgressSummary projectId={p._id} refreshKey={p.updatedAt} /><p>Unattributed spending: {formatMoney(p.unattributedSpent)}</p></section></div><section className={panel}><h2 className="text-xl font-bold">Before, progress and after</h2><Evidence photos={p.photos} /></section><section className={panel}><h2 className="text-xl font-bold">Resource updates</h2>{[...p.resourceUpdates].reverse().map(r => <div key={r._id}><p>{r.note}</p><p className="text-sm text-stone-500">{new Date(r.createdAt).toLocaleString()} · Recorded total spent: {formatMoney(r.fundingSpent)}</p></div>)}{!p.resourceUpdates.length && <EmptyState title="No resource updates recorded." message="Recorded activity will appear here."/>}</section><Link className="underline text-brand-800" to={`/csr/reports?project=${id}`}>View report</Link></>}</Page>;
}
