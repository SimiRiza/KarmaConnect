import React, { useState } from 'react';
import ContributeModal from './ContributeModal';
export default function ContributionActions({ projectId, completed, onSuccess }) {
  const [open, setOpen] = useState(false), [message, setMessage] = useState('');
  return <section className="space-y-3">{message && <p role="status" className="text-brand-800">{message}</p>}{!completed && <button className="bg-accent-500 text-white rounded-xl px-5 py-3" onClick={() => setOpen(true)}>Record a contribution</button>}{open && <ContributeModal open projectId={projectId} onClose={() => setOpen(false)} onSuccess={c => { setMessage(c.status === 'pending' ? 'Contribution recorded. Awaiting NGO confirmation.' : 'Contribution confirmed and totals updated.'); onSuccess?.(); }} />}</section>;
}
