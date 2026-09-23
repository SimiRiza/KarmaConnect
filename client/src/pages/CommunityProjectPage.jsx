import ProjectTrust from '../components/ProjectTrust';
import ProgressSummary from '../components/ProgressSummary';
import ContributionActions from '../components/ContributionActions';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import SkillRequestCard from '../components/SkillRequestCard';
import { ApplyModal } from '../components/ApplyModal';
export default function CommunityProjectPage() {
  const { id } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [project, setProject] = useState(null), [error, setError] = useState(''), [open, setOpen] = useState(false), [success, setSuccess] = useState('');
  useEffect(() => { let active = true; api.get(`/projects/${id}`).then(r => { if (active) setProject(r.data.project); }).catch(e => { if (active) setError(e.response?.data?.message || 'Could not load project.'); }); return () => { active = false; }; }, [id]);
  const apply = async data => { try { await api.post(`/projects/${id}/apply`, data); setOpen(false); setSuccess('Application submitted. The NGO will review it.'); setError(''); } catch (e) { setOpen(false); setError(e.response?.data?.message || 'Could not apply.'); } };
  return <div className="max-w-5xl mx-auto px-4 py-10 space-y-5">{error && <p role="alert" className="text-red-700">{error}</p>}{success && <p role="status" className="text-brand-800">{success}</p>}{project ? <><h1 className="text-3xl font-bold">{project.title}</h1><ProjectTrust projectId={id} /><StatusBadge status={project.status} /><p>{project.location.city} · {project.category} · Urgency: {project.sourceProblemId?.urgency || 'Not specified'}</p>{project.photos?.before?.[0] && <img className="w-full max-h-80 object-cover rounded-2xl" src={project.photos.before[0]} alt={project.title} />}<p className="whitespace-pre-wrap">{project.description}</p><p>Skills needed: {project.requiredSkills.join(', ') || 'All skills welcome'}</p><ProgressSummary projectId={id} refreshKey={refreshKey} /><ContributionActions projectId={id} completed={project.status === 'completed'} onSuccess={() => setRefreshKey(k => k + 1)} />{project.teamId ? <Link className="inline-block bg-brand-600 text-white rounded-xl px-5 py-3" to={`/teams/${project.teamId}`}>Open team workspace</Link> : project.status !== 'completed' && <button className="bg-accent-500 text-white rounded-xl px-5 py-3" onClick={() => setOpen(true)}>I want to help</button>}<h2 className="text-2xl font-bold">Skill requests</h2>{project.skillRequests.filter(r => r.status === 'open').map(r => <SkillRequestCard key={r._id} request={r} />)}{!project.skillRequests.length && <p>No specific skill requests yet.</p>}<ApplyModal open={open} onClose={() => setOpen(false)} onSubmit={apply} /></> : !error && <p>Loading project...</p>}</div>;
}
