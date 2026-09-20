import MatchScoreBadge from './MatchScoreBadge';
import React from 'react';
import { Link } from 'react-router-dom';
import NGOCredibilityCard from './NGOCredibilityCard';
import FundingProgressBar from './FundingProgressBar';
import StatusBadge from './StatusBadge';
import { formatMoney } from './PortfolioSummaryCard';
export default function CSRProjectCard({
  project
}) {
  return <article className="min-w-0 bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">{project.photos?.before?.[0] && <img src={project.photos.before[0]} alt={project.title} className="h-40 w-full object-cover" />}<div className="p-5 space-y-4"><div className="flex flex-wrap gap-2 items-center"><StatusBadge status={project.status} /><span className="text-sm capitalize">{project.category.replaceAll('_', ' ')}</span></div><h3 className="text-xl font-bold"><Link className="hover:text-brand-700" to={`/csr/projects/${project._id}`}>{project.title}</Link></h3><p className="text-stone-600">{[project.location?.city, project.location?.area].filter(Boolean).join(', ')} · Urgency: {project.urgency || 'Not specified'}</p><MatchScoreBadge project={project} /><NGOCredibilityCard ngo={project.ngo} compact /><p><strong>{project.beneficiaries?.estimatedCount || 0}</strong> estimated beneficiaries</p><p className="text-sm">Expected end: {project.timeline?.expectedEndDate ? new Date(project.timeline.expectedEndDate).toLocaleDateString() : 'Not specified'}</p><FundingProgressBar required={project.fundingRequired} received={project.fundingReceived} spent={project.fundingSpent} /><p className="font-semibold text-brand-800">Funding gap: {formatMoney(Math.max(0, project.fundingRequired - project.fundingReceived))}</p><Link className="inline-block bg-brand-600 text-white rounded-xl px-4 py-2" to={`/csr/projects/${project._id}`}>Evaluate project</Link></div></article>;
}
