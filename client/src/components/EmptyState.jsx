import React from 'react';
import { Inbox } from 'lucide-react';

export const EmptyState = ({ title, message, action }) => {
  return (
    <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Inbox className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-stone-900">{title}</h3>
      <p className="mt-2 text-sm text-stone-600">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};

export default EmptyState;
