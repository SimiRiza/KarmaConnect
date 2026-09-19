import React from 'react';

const urgencyColors = {
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  high: 'bg-red-100 text-red-700 border-red-200'
};

export const UrgencyBadge = ({ urgency }) => {
  const value = urgency || 'medium';
  const classes = urgencyColors[value] || 'bg-stone-100 text-stone-600 border-stone-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide ${classes}`}>
      {value}
    </span>
  );
};

export default UrgencyBadge;
