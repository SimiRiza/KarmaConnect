import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import ContributionFields, { initialContributionForm, contributionPayload } from './ContributionFields';
import ContributionTypeIcon from './ContributionTypeIcon';
export const ContributeModal = ({ open, projectId, onClose, onSuccess }) => {
  const dialog = useRef(null), retry = useRef(null);
  const [type, setType] = useState('money'), [form, setForm] = useState(initialContributionForm), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { if (open && !dialog.current.open) dialog.current.showModal(); }, [open]);
  const submit = async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    const payload = contributionPayload(type, form), signature = JSON.stringify(payload);
    if (retry.current?.signature !== signature) retry.current = { signature, key: crypto.randomUUID() };
    try { const r = await api.post('/projects/' + projectId + '/contributions', payload, { headers: { 'Idempotency-Key': retry.current.key } }); onSuccess?.(r.data.contribution); onClose(); }
    catch (e) { setError(e.response?.data?.message || 'Could not record contribution. Your details are kept for retry.'); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} className="w-[calc(100%_-_2rem)] max-w-xl rounded-3xl p-6 backdrop:bg-stone-900/50 max-h-[90vh] overflow-y-auto"><div className="flex justify-between gap-3 mb-5"><h2 className="text-2xl font-bold">Record a contribution</h2><button disabled={busy} type="button" aria-label="Close contribution form" onClick={onClose}>Close</button></div><form onSubmit={submit} className="space-y-4"><label className="block">Contribution type<select className="block w-full border rounded-xl p-3" value={type} onChange={e => setType(e.target.value)}>{['time', 'skills', 'money', 'materials'].map(t => <option key={t} value={t}>{t}</option>)}</select></label><p className="flex gap-2 text-brand-800"><ContributionTypeIcon type={type} />{type === 'materials' ? 'Materials wait for NGO confirmation before counting.' : type === 'money' ? 'Simulated INR donation. No real payment is processed.' : 'Current team members can log their completed work.'}</p><ContributionFields type={type} form={form} setForm={setForm} />{error && <p role="alert" className="text-red-700">{error}</p>}<button disabled={busy} className="bg-accent-500 text-white rounded-xl px-5 py-3">{busy ? 'Recording...' : 'Submit contribution'}</button></form></dialog>;
};
export default ContributeModal;
