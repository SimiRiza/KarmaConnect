import React from 'react';
import { Link } from 'react-router-dom';
import MatchScoreBadge from './MatchScoreBadge';
import StatusBadge from './StatusBadge';
import FundingProgressBar from './FundingProgressBar';
export default function VolunteerMatchCard({ project }) {
  const photo = project.targetType === 'project' ? project.photos?.before?.[0] : project.photos?.[0];
  return <article className="rounded-2xl border bg-white overflow-hidden">{photo && <img className="h-40 w-full object-cover" src={photo} alt={project.title} />}<div className="p-5 space-y-3"><p>{project.location?.city} · {project.category.replaceAll('_', ' ')} · Urgency: {project.urgency || 'Not specified'}</p><StatusBadge status={project.status} /><h3 className="text-xl font-bold">{project.title}</h3><MatchScoreBadge project={project} />{project.targetType === 'project' && <FundingProgressBar required={project.fundingRequired} received={project.fundingReceived} spent={project.fundingSpent} />}<Link className="inline-block rounded-xl bg-brand-600 text-white px-4 py-2" to={`/${project.targetType === 'project' ? 'projects' : 'problems'}/${project._id}`}>View and help</Link></div></article>;
}
