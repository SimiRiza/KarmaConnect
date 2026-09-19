import React from 'react';
import { IndianRupee } from 'lucide-react';

/**
 * FundingProgressBar — shows funding goal, received and percentage.
 * Props: required (number), received (number), spent (number)
 */
const FundingProgressBar = ({ required = 0, received = 0, spent = 0 }) => {
  const pct = required > 0 ? Math.min(100, Math.round((received / required) * 100)) : 0;
  const spentPct = received > 0 ? Math.min(100, Math.round((spent / received) * 100)) : 0;

  const fmt = (n) =>
    n >= 100000
      ? `₹${(n / 100000).toFixed(1)}L`
      : n >= 1000
      ? `₹${(n / 1000).toFixed(1)}K`
      : `₹${n}`;

  return (
    <div className="space-y-2">
      {/* Main bar */}
      <div className="h-3 rounded-full bg-stone-100 overflow-hidden relative">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-xs text-stone-500">
        <span className="flex items-center gap-0.5 font-semibold text-brand-700">
          <IndianRupee className="w-3 h-3" />
          {fmt(received)} raised
        </span>
        <span className="font-bold text-stone-800">{pct}%</span>
        <span>Goal: {fmt(required)}</span>
      </div>

      {/* Spent sub-bar (if any spending has occurred) */}
      {spent > 0 && (
        <div className="mt-1">
          <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-700"
              style={{ width: `${spentPct}%` }}
            />
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            {fmt(spent)} spent ({spentPct}% of received)
          </p>
        </div>
      )}
    </div>
  );
};

export default FundingProgressBar;
