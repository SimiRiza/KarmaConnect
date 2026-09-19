import React from 'react';

const statusColors = {
  reported: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  team_forming: 'bg-blue-100 text-blue-800 border-blue-200',
  funding_needed: 'bg-orange-100 text-orange-800 border-orange-200',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  adopted: 'bg-teal-100 text-teal-800 border-teal-200'
};

const statusLabels = {
  reported: 'Reported',
  team_forming: 'Team Forming',
  funding_needed: 'Funding Needed',
  in_progress: 'In Progress',
  completed: 'Completed',
  adopted: 'Adopted'
};

export const StatusBadge = ({ status }) => {
  const value = status || 'reported';
  const classes = statusColors[value] || 'bg-stone-100 text-stone-700 border-stone-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide ${classes}`}>
      {statusLabels[value] || value}
    </span>
  );
};

export default StatusBadge;
