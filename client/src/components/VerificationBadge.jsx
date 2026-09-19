import React from 'react';
import { ShieldCheck, Clock, XCircle } from 'lucide-react';

const CONFIGS = {
  verified: {
    label: 'Verified NGO',
    icon: ShieldCheck,
    className: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  },
  pending: {
    label: 'Verification Pending',
    icon: Clock,
    className: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  rejected: {
    label: 'Verification Rejected',
    icon: XCircle,
    className: 'text-red-700 bg-red-50 border-red-200',
  },
};

/**
 * VerificationBadge — displays NGO verification status.
 * Props: status: 'verified' | 'pending' | 'rejected'
 */
const VerificationBadge = ({ status = 'pending', className = '' }) => {
  const cfg = CONFIGS[status] || CONFIGS.pending;
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.className} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
};

export default VerificationBadge;
