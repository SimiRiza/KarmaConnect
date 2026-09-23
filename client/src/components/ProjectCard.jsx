import ProjectTrust from './ProjectTrust';
import React from 'react';
import { Link } from 'react-router-dom';
import StatusPipeline from './StatusPipeline';
import FundingProgressBar from './FundingProgressBar';
export default function ProjectCard({
  project
}) {
  return <Link to={`/ngo/projects/${project._id}`} className="block min-w-0 space-y-3 bg-white border border-stone-200 rounded-2xl p-5 hover:border-brand-400 shadow-sm">{project.photos?.before?.[0] && <img className="w-full h-36 rounded-xl object-cover" src={project.photos.before[0]} alt={`${project.title} before work`} />}{project.status === 'completed' && project.photos?.after?.[0] && <img className="w-full h-36 rounded-xl object-cover" src={project.photos.after[0]} alt={`${project.title} after completion`} />}<h3 className="font-bold text-lg">{project.title}</h3><ProjectTrust projectId={project._id} compact /><p className="text-stone-600">{[project.location?.city, project.location?.area].filter(Boolean).join(', ')} · {project.category?.replaceAll('_', ' ')}</p><StatusPipeline currentStatus={project.status} /><p className="text-sm">{project.teamMembers?.length || 0} accepted · {project.applicantsCount || 0} applied · {project.volunteersNeeded} volunteers needed</p><FundingProgressBar required={project.fundingRequired} received={project.fundingReceived} spent={project.fundingSpent} /></Link>;
}
