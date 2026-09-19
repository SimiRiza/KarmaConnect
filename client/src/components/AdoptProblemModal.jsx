import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
export default function AdoptProblemModal({
  problem,
  onClose,
  onConfirm,
  busy
}) {
  const dialog = useRef(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return <dialog ref={dialog} onCancel={e => {
    if (busy) e.preventDefault();else onClose();
  }} className="rounded-2xl p-6 max-w-lg w-[calc(100%-2rem)] backdrop:bg-black/40" aria-labelledby="adopt-title"><h2 id="adopt-title" className="text-xl font-bold">Adopt this problem?</h2><p className="my-4">Adopting “{problem.title}” creates a managed project for your NGO and links its volunteers and progress to the community report.</p><div className="flex flex-wrap gap-3"><button disabled={busy} onClick={onConfirm} className="bg-accent-500 text-white px-4 py-2 rounded-xl disabled:opacity-50">{busy ? 'Adopting...' : 'Adopt now'}</button><Link onClick={onClose} className="border rounded-xl px-4 py-2" to="/ngo/projects/new" state={{
        sourceProblem: problem
      }}>Plan project first</Link><button disabled={busy} onClick={onClose} className="px-4 py-2">Cancel</button></div></dialog>;
}
