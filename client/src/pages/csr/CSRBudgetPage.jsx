import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import React from 'react';
import { Link } from 'react-router-dom';
import * as csr from '../../services/csrService';
import PortfolioSummaryCard, { formatMoney } from '../../components/PortfolioSummaryCard';
import { Page, useLoad, panel } from './CSRLayout';
export default function CSRBudgetPage() {
  const {
    data,
    loading,
    error
  } = useLoad(csr.portfolio);
  const s = data?.summary;
  return <Page title="CSR budget overview" error={error} loading={loading}>{s && <><PortfolioSummaryCard summary={s} /><section className={`${panel} overflow-x-auto`}><h2 className="text-xl font-bold">Allocation breakdown by project</h2><p>Simulated INR allocations. Remaining is the unspent allocation balance, not your company's remaining annual budget. Withdrawn allocations are excluded.</p><table className="hidden md:table w-full text-left"><thead><tr className="border-b">{['Project', 'Status', 'Allocated', 'Spent', 'Remaining'].map(h => <th className="py-3 px-2" key={h} scope="col">{h}</th>)}</tr></thead><tbody>{s.projects.map(p => <tr key={p._id} className="border-b"><th scope="row" className="p-3 font-medium"><Link className="text-brand-800 underline" to={`/csr/projects/${p._id}/monitor`}>{p.title}</Link></th><td><StatusBadge status={p.status}/></td><td className="p-2 tabular-nums">{formatMoney(p.allocated)}</td><td className="p-2 tabular-nums">{formatMoney(p.spent)}</td><td className="p-2 tabular-nums">{formatMoney(p.remaining)}</td></tr>)}</tbody><tfoot><tr className="font-bold"><th scope="row" className="p-3" colSpan={2}>Total</th><td className="p-2">{formatMoney(s.totalBudgetAllocated)}</td><td className="p-2">{formatMoney(s.totalAmountSpent)}</td><td className="p-2">{formatMoney(s.remaining)}</td></tr></tfoot></table><div className="md:hidden space-y-3">{s.projects.map(p=><article key={p._id} className="border rounded-xl p-3 space-y-2"><Link className="underline font-bold text-brand-800" to={`/csr/projects/${p._id}/monitor`}>{p.title}</Link><StatusBadge status={p.status}/><dl>{[["Allocated",p.allocated],["Spent",p.spent],["Remaining",p.remaining]].map(([label,value])=><div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd>{formatMoney(value)}</dd></div>)}</dl></article>)}</div>{!s.projects.length && <EmptyState title="No current allocations." message="Recorded activity will appear here." />}</section></>}</Page>;
}
