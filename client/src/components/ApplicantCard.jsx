import React from 'react';
import { Check, X, User, MapPin, Briefcase } from 'lucide-react';

const STATUS_STYLES = {
  pending: 'text-amber-700 bg-amber-50 border-amber-200',
  accepted: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  rejected: 'text-red-700 bg-red-50 border-red-200',
};

/**
 * ApplicantCard — shows a volunteer application row with accept/reject actions.
 * Props:
 *   applicant: Application doc (with populated userId)
 *   onReview: (appId, 'accepted'|'rejected') => void
 *   loading: bool (disables buttons during API call)
 */
const ApplicantCard = ({ applicant, onReview, loading = false }) => {
  const user = applicant.userId || {};
  const profile = applicant.userProfile || {};
  const statusStyle = STATUS_STYLES[applicant.status] || STATUS_STYLES.pending;

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-4">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0">
        {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-bold text-stone-900 text-sm">{user.name || 'Unknown Volunteer'}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${statusStyle}`}>
            {applicant.status}
          </span>
        </div>

        {user.email && (
          <p className="text-xs text-stone-500 mb-1">{user.email}</p>
        )}

        {user.location?.city && (
          <p className="text-xs text-stone-400 flex items-center gap-1 mb-1">
            <MapPin className="w-3 h-3" /> {user.location.city}
          </p>
        )}

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {profile.skills.slice(0, 5).map((skill) => (
              <span key={skill} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Note */}
        {applicant.note && (
          <p className="text-xs text-stone-600 bg-stone-50 rounded-lg p-2 border border-stone-100 line-clamp-2">
            "{applicant.note}"
          </p>
        )}

        {/* Contribution type */}
        {applicant.contributionType && (
          <p className="text-xs text-stone-400 mt-1 flex items-center gap-1">
            <Briefcase className="w-3 h-3" /> {applicant.contributionType}
          </p>
        )}
      </div>

      {/* Actions (only for pending) */}
      {applicant.status === 'pending' && (
        <div className="flex sm:flex-col gap-2 shrink-0 items-end">
          <button
            onClick={() => onReview(applicant._id, 'accepted')}
            disabled={loading}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-60"
          >
            <Check className="w-3.5 h-3.5" /> Accept
          </button>
          <button
            onClick={() => onReview(applicant._id, 'rejected')}
            disabled={loading}
            className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-60"
          >
            <X className="w-3.5 h-3.5" /> Reject
          </button>
        </div>
      )}
    </div>
  );
};

export default ApplicantCard;
