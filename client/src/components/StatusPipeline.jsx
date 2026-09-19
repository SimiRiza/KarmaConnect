import React from 'react';
import { CheckCircle, CircleDot, Users, AlertCircle, TrendingUp, Clock } from 'lucide-react';

const PIPELINE = [
  { key: 'adopted', label: 'Adopted', icon: CircleDot },
  { key: 'team_forming', label: 'Team Forming', icon: Users },
  { key: 'funding_needed', label: 'Funding Needed', icon: AlertCircle },
  { key: 'in_progress', label: 'In Progress', icon: TrendingUp },
  { key: 'completed', label: 'Completed', icon: CheckCircle },
];

/**
 * StatusPipeline — horizontal step indicator showing project lifecycle.
 * currentStatus: one of PIPELINE keys.
 */
const StatusPipeline = ({ currentStatus }) => {
  const currentIdx = PIPELINE.findIndex((s) => s.key === currentStatus);

  return (
    <div className="flex items-center w-full overflow-x-auto py-1">
      {PIPELINE.map((step, idx) => {
        const Icon = step.icon;
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                  isDone
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : isCurrent
                    ? 'bg-white border-brand-600 text-brand-600 ring-2 ring-brand-200'
                    : 'bg-white border-stone-200 text-stone-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  isDone ? 'text-brand-600' : isCurrent ? 'text-brand-700 font-bold' : 'text-stone-400'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < PIPELINE.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mt-[-14px] rounded-full transition-all ${
                  idx < currentIdx ? 'bg-brand-400' : 'bg-stone-200'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default StatusPipeline;
