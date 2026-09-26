import EmptyState from '../../components/EmptyState';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import * as csr from '../../services/csrService';
import StatusPipeline from '../../components/StatusPipeline';
import { formatMoney } from '../../components/PortfolioSummaryCard';
import { Page, useLoad, panel } from './CSRLayout';
export default function CSRPortfolioPage() {
  const [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const {
    data,
    error,
    loading,
    refresh,
    setError
  } = useLoad(() => csr.fundings({
    status
  }), [status]);
  const withdraw = async id => {
    if (!window.confirm('Withdraw this unspent simulated allocation?')) return;
    setBusy(true);
    setError('');
    try {
      await csr.withdraw(id);
      setMessage('Allocation withdrawn.');
      await refresh();
    } catch (e) {
      setError(e.response?.data?.message || 'Could not withdraw.');
    } finally {
      setBusy(false);
    }
  };
  const groups = Object.values((data?.fundings || []).reduce((all, f) => {
    const key = f.projectId?._id || 'missing';
    (all[key] ||= {
      project: f.projectId,
      fundings: []
    }).fundings.push(f);
    return all;
  }, {}));
  return <Page title="My portfolio" error={error} loading={loading}><label>Funding status <select className="border rounded-xl px-3 py-2" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{['allocated', 'in_progress', 'completed', 'withdrawn'].map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select></label>{message && <p role="status" className="text-brand-700">{message}</p>}<div className="grid lg:grid-cols-2 gap-5">{groups.map(({
        project: p,
        fundings
      }) => <article key={p?._id || 'missing'} className={`${panel} min-w-0`}><h2 className="text-xl font-bold">{p?.title || 'Project unavailable'}</h2>{p && <StatusPipeline currentStatus={p.status} />}{fundings.map(f => <div key={f._id} className="border-t pt-3 space-y-2"><p className="font-semibold">{formatMoney(f.amountAllocated)} · {f.status.replaceAll('_', ' ')}</p><p>Spent: {formatMoney(f.amountSpentSoFar)} · {new Date(f.allocationDate).toLocaleDateString()}</p>{f.notes && <p>{f.notes}</p>}{f.status === 'allocated' && f.amountSpentSoFar === 0 && <button disabled={busy} onClick={() => withdraw(f._id)} className="border border-red-200 text-red-700 rounded-lg px-3 py-2 disabled:opacity-50">Withdraw allocation</button>}</div>)}{p && <div className="flex flex-wrap gap-4 text-brand-800 underline"><Link to={`/csr/projects/${p._id}`}>Evaluation</Link>{fundings.some(f => f.status !== 'withdrawn') && <><Link to={`/csr/projects/${p._id}/monitor`}>Monitor project</Link><Link to={`/csr/reports?project=${p._id}`}>View report</Link></>}</div>}</article>)}</div>{!error && !loading && !groups.length && <EmptyState title="No funding records match this status." message="Recorded activity will appear here."/>}</Page>;
}
