import React from 'react';
import VerificationBadge from './VerificationBadge';
export default function NGOCredibilityCard({
  ngo,
  compact = false
}) {
  if (!ngo) return <p>NGO details unavailable.</p>;
  return <section className="rounded-xl border border-brand-100 bg-brand-50/50 p-4 space-y-3"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{ngo.ngoName}</h3><VerificationBadge status={ngo.verificationStatus} /></div><dl className="flex flex-wrap gap-6"><div><dt className="text-sm text-stone-600">Completed projects</dt><dd className="text-xl font-semibold">{ngo.previousProjectsCount || 0}</dd></div><div><dt className="text-sm text-stone-600">Beneficiaries reached</dt><dd className="text-xl font-semibold">{ngo.totalBeneficiariesReached || 0}</dd></div></dl>{!compact && ngo.about && <p>{ngo.about}</p>}</section>;
}
