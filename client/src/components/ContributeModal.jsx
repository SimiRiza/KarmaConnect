import React, { useState } from 'react';
import { X } from 'lucide-react';

export const ContributeModal = ({ open, onClose, onSubmit, type = 'money' }) => {
  const [form, setForm] = useState({ amount: '', note: '' });

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      type,
      amount: type === 'money' ? Number(form.amount || 0) : 0,
      note: form.note
    });
    setForm({ amount: '', note: '' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Contribute</p>
            <h3 className="mt-1 text-2xl font-extrabold text-stone-900">Support this problem</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-stone-200 p-2 text-stone-500 hover:text-stone-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {type === 'money' && (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700">Amount (₹ / $)</label>
              <input
                type="number"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="500"
                className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700">Note</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={4}
              placeholder="Share a short note about your support."
              className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            This is a placeholder contribution flow for now. Real payment processing will be added in a later prompt.
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
              Cancel
            </button>
            <button type="submit" className="rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-600">
              Record contribution
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContributeModal;
