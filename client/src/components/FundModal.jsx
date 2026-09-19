import React, { useEffect, useRef, useState } from 'react';
import * as csr from '../services/csrService';
import { formatMoney } from './PortfolioSummaryCard';
import { inputClass } from './ProjectForm';
export default function FundModal({
  project,
  onClose,
  onSuccess
}) {
  const dialog = useRef(null),
    request = useRef(null);
  const [amount, setAmount] = useState(''),
    [notes, setNotes] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const gap = Math.max(0, project.fundingRequired - project.fundingReceived);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const payload = {
      amountAllocated: Number(amount),
      notes
    };
    const signature = JSON.stringify(payload);
    if (!request.current || request.current.signature !== signature) request.current = {
      key: crypto.randomUUID(),
      signature
    };
    try {
      await csr.fund(project._id, payload, request.current.key);
      await onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not confirm allocation. Retry uses the same request key.');
    } finally {
      setBusy(false);
    }
  };
  return <dialog ref={dialog} onCancel={e => {
    if (busy) e.preventDefault();else onClose();
  }} aria-labelledby="fund-title" className="max-w-lg w-[calc(100%-2rem)] rounded-2xl p-6 backdrop:bg-black/40"><h2 id="fund-title" className="text-2xl font-bold">Fund this project</h2><p className="mt-2">{project.title}</p><p className="my-4 bg-amber-50 border border-amber-200 p-3 rounded-xl">Simulated allocation — no payment is collected. Payment processing will be added in a future update.</p><p>Current funding gap: <strong>{formatMoney(gap)}</strong></p><form onSubmit={submit} className="space-y-4 mt-4"><label className="block">Allocation amount (INR)<input autoFocus required type="number" min="0.01" max={gap} step="0.01" className={inputClass} value={amount} onChange={e => setAmount(e.target.value)} disabled={busy} /></label><label className="block">Notes (optional)<textarea className={inputClass} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} disabled={busy} /></label>{error && <p role="alert" className="text-red-700">{error}</p>}<div className="flex gap-3"><button disabled={busy} className="rounded-xl bg-accent-500 text-white px-4 py-3 disabled:opacity-50">{busy ? 'Confirming...' : 'Confirm simulated allocation'}</button><button type="button" disabled={busy} onClick={onClose} className="px-4 py-3">Cancel</button></div></form></dialog>;
}
