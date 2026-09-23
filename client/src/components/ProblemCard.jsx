import ProjectTrust from './ProjectTrust';
import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Bookmark, BookmarkCheck, ArrowRight } from 'lucide-react';
import StatusBadge from './StatusBadge';
import UrgencyBadge from './UrgencyBadge';

const defaultImage = 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80';

export const ProblemCard = ({ problem, saved = false, onToggleSave, matchScore, onApply, onAdopt, adoptDisabled = false }) => {
  const image = problem?.photos?.[0] || defaultImage;
  const locationText = problem?.location ? [problem.location.city, problem.location.area].filter(Boolean).join(' • ') : 'Location not specified';

  return (
    <div className="group overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
      <div>
        <div className="relative">
          <img src={image} alt={problem.title} className="h-48 w-full object-cover" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
            <StatusBadge status={problem.status} />
            {!onAdopt && <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSave?.(problem._id);
              }}
              className="rounded-full bg-white/90 p-2 text-stone-700 shadow-sm backdrop-blur-sm hover:bg-white transition"
              title={saved ? 'Remove from saved' : 'Save this problem'}
            >
              {saved ? <BookmarkCheck className="h-4 w-4 text-brand-700" /> : <Bookmark className="h-4 w-4" />}
            </button>}
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-700 border border-brand-200">
                {problem.category || 'Other'}
              </span>
              {matchScore && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  ✨ {matchScore}% Match
                </span>
              )}
            </div>
            <UrgencyBadge urgency={problem.urgency} />
          </div>

          <div>
            <h3 className="line-clamp-2 text-lg font-bold text-stone-900 group-hover:text-brand-700 transition">
              {problem.title}
            </h3>
            {problem.linkedProjectId && <ProjectTrust projectId={problem.linkedProjectId} compact />}
            <div className="mt-2 flex items-center gap-1.5 text-sm text-stone-600">
              <MapPin className="h-4 w-4 text-brand-600 shrink-0" />
              <span className="truncate">{locationText}</span>
            </div>
          </div>

          <p className="line-clamp-3 text-sm leading-relaxed text-stone-600">
            {problem.description}
          </p>
        </div>
      </div>

      <div className="p-4 pt-0 flex items-center gap-2">
        {onApply ? (
          <button
            type="button"
            onClick={() => onApply(problem)}
            className="flex-1 rounded-xl bg-accent-500 py-2.5 px-3 text-xs sm:text-sm font-bold text-white transition hover:bg-accent-600 text-center shadow-sm"
          >
            I Want to Help
          </button>
        ) : null}
        {onAdopt ? <button disabled={adoptDisabled} onClick={() => onAdopt(problem)} className="w-full rounded-xl bg-accent-500 px-4 py-3 font-semibold text-white disabled:opacity-50">Adopt This Problem</button> : <Link
          to={`/problems/${problem._id}`}
          className={`rounded-xl border border-stone-300 py-2.5 px-3 text-xs sm:text-sm font-semibold text-stone-700 transition hover:bg-stone-50 flex items-center justify-center gap-1 ${onApply ? '' : 'w-full bg-brand-50/50 hover:bg-brand-50 text-brand-800 border-brand-200 font-bold'}`}
        >
          <span>Details</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>}
      </div>
    </div>
  );
};

export default ProblemCard;
