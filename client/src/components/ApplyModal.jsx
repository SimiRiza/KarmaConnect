import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const contributionOptions = [
  { value: 'time', label: 'Time' },
  { value: 'skills', label: 'Skills' },
  { value: 'money', label: 'Money' },
  { value: 'materials', label: 'Materials' }
];

export const ApplyModal = ({ open, onClose, onSubmit }) => {
  const [form, setForm] = useState({ contributionType: 'time', relevantSkills: '', note: '' });

  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dialog = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => { dialog.current?.close(); previous?.focus(); };
  }, [open]);
  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await onSubmit({
      contributionType: form.contributionType,
      relevantSkills: form.relevantSkills.split(',').map((item) => item.trim()).filter(Boolean),
      note: form.note
    });
    setForm({ contributionType: 'time', relevantSkills: '', note: '' });
    } catch(e) { setError(e.response?.data?.message || 'Unable to submit application. Please try again.'); } finally { setBusy(false); }
  };

  return (
    <dialog ref={dialog} aria-label="Apply to this problem" onCancel={e=>{if(busy)e.preventDefault();else onClose();}} className="w-[calc(100%-2rem)] max-w-lg rounded-3xl backdrop:bg-stone-900/50">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">I Want to Help</p>
            <h3 className="mt-1 text-2xl font-extrabold text-stone-900">Apply to this problem</h3>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close application" className="rounded-full border border-stone-200 p-2 text-stone-500 hover:text-stone-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <p role="alert" className="text-red-800">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700">Contribution type</label>
            <div className="grid grid-cols-2 gap-2">
              {contributionOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm({ ...form, contributionType: option.value })}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                    form.contributionType === option.value
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700" htmlFor="ApplyModal-field-1">Relevant skills</label>
            <input id="ApplyModal-field-1"
              value={form.relevantSkills}
              onChange={(e) => setForm({ ...form, relevantSkills: e.target.value })}
              placeholder="Design, event support, teaching"
              className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700" htmlFor="ApplyModal-field-2">Short note</label>
            <textarea id="ApplyModal-field-2"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={4}
              placeholder="Tell the organizer how you can help."
              className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-600">
              Submit application
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
};

export default ApplyModal;
