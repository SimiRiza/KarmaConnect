import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Users, Calendar, TrendingUp, CheckCircle, Clock, AlertCircle, CircleDot, Layers } from 'lucide-react';

const STATUS_CONFIG = {
  adopted: { label: 'Adopted', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: CircleDot },
  team_forming: { label: 'Team Forming', color: 'text-violet-700 bg-violet-50 border-violet-200', icon: Users },
  funding_needed: { label: 'Funding Needed', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: AlertCircle },
  in_progress: { label: 'In Progress', color: 'text-teal-700 bg-teal-50 border-teal-200', icon: TrendingUp },
  completed: { label: 'Completed', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle },
  reported: { label: 'Reported', color: 'text-stone-600 bg-stone-50 border-stone-200', icon: Clock },
};

const CATEGORY_LABELS = {
  cleaning: 'Cleaning',
  repair: 'Repair',
  environment: 'Environment',
  education: 'Education',
  elderly_support: 'Elderly Support',
  animal_welfare: 'Animal Welfare',
  health: 'Health',
  other: 'Other',
};

/**
 * ProjectCard — compact card for the NGO's projects list.
 * Links to /ngo/projects/:id.
 */
const ProjectCard = ({ project }) => {
  const cfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.adopted;
  const StatusIcon = cfg.icon;
  const fundingPct = project.fundingRequired > 0
    ? Math.min(100, Math.round((project.fundingReceived / project.fundingRequired) * 100))
    : 0;

  return (
    <Link
      to={`/ngo/projects/${project._id}`}
      className="block bg-white border border-stone-200 rounded-2xl p-5 hover:shadow-md hover:border-brand-200 transition-all duration-200 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-stone-900 text-sm leading-snug group-hover:text-brand-700 transition-colors line-clamp-2">
            {project.title}
          </h3>
          <span className="text-xs text-stone-400 mt-0.5 block">
            {CATEGORY_LABELS[project.category] || project.category}
          </span>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${cfg.color}`}>
          <StatusIcon className="w-3 h-3" />
          {cfg.label}
        </span>
      </div>

      {/* Location + Team */}
      <div className="flex items-center gap-3 text-xs text-stone-500 mb-3">
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {project.location?.city || 'Unknown'}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {project.teamMembers?.length || 0} / {project.volunteersNeeded || 0} volunteers
        </span>
        {project.timeline?.expectedEndDate && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(project.timeline.expectedEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
          </span>
        )}
      </div>

      {/* Funding bar */}
      {project.fundingRequired > 0 && (
        <div>
          <div className="flex justify-between text-xs text-stone-500 mb-1">
            <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> Funding</span>
            <span className="font-semibold text-stone-700">{fundingPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-400 to-teal-400 transition-all duration-500"
              style={{ width: `${fundingPct}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  );
};

export default ProjectCard;
