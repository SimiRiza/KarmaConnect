import ProjectTrust from '../components/ProjectTrust';
import ProgressSummary from '../components/ProgressSummary';
import PendingContributions from '../components/PendingContributions';
import ProjectSkillRequests from '../components/ProjectSkillRequests';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as ngo from '../services/ngoService';
import StatusPipeline, { STATUSES } from '../components/StatusPipeline';
import ApplicantCard from '../components/ApplicantCard';
import ProjectForm, { Field, inputClass } from '../components/ProjectForm';
const tabs = ['Overview', 'Applicants', 'Team', 'Resources', 'Photos'];
export default function ProjectDetailPage() {
  const {
    id
  } = useParams();
  const [project, setProject] = useState(null),
    [applicants, setApplicants] = useState([]),
    [tab, setTab] = useState('Overview'),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState('');
  const load = useCallback(async () => {
    const [p, a] = await Promise.all([ngo.getProjectById(id), ngo.getApplicants(id)]);
    setProject(p.data.project);
    setApplicants(a.data.applicants);
  }, [id]);
  useEffect(() => {
    load().catch(e => setError(e.response?.data?.message || 'Could not load project.'));
  }, [load]);
  const action = async (fn, message) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await fn();
      await load();
      setSuccess(message);
      return true;
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save changes.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const next = project && STATUSES[STATUSES.indexOf(project.status) + 1];
  const reason = !project ? '' : project.status !== 'in_progress' ? 'Advance the project to In progress first.' : !project.photos?.after?.length ? 'Upload at least one after photo.' : !(project.beneficiaries?.estimatedCount > 0) ? 'Set a positive beneficiary count in Edit project.' : '';
  return <div className="max-w-6xl mx-auto p-6 space-y-6"><Link to="/ngo/projects" className="text-brand-700">Back to projects</Link>{error && <p role="alert" className="bg-red-50 text-red-700 p-4 rounded-xl">{error}</p>}{success && <p role="status" className="text-brand-700">{success}</p>}{!project ? <p>{error ? 'Project unavailable.' : 'Loading project...'}</p> : <><div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-3xl font-bold">{project.title}</h1><ProjectTrust projectId={id} /><p className="text-stone-600 mt-2">{project.location.city} · {project.category.replaceAll('_', ' ')}</p></div><button onClick={() => setEditing(v => !v)} className="border rounded-xl px-4 py-2">{editing ? 'Close editor' : 'Edit project'}</button></div><StatusPipeline currentStatus={project.status} /><div className="flex flex-wrap gap-3 items-center">{next && next !== 'completed' && <button disabled={busy} className="bg-brand-600 text-white rounded-xl px-4 py-2 disabled:opacity-50" onClick={() => action(() => ngo.updateProjectStatus(id, next), 'Status updated.')}>Move to {next.replaceAll('_', ' ')}</button>}{project.status !== 'completed' && <><button disabled={busy || !!reason} title={reason || 'Complete this project'} aria-describedby="completion-help" className="bg-accent-500 text-white rounded-xl px-4 py-2 disabled:opacity-50" onClick={() => action(() => ngo.completeProject(id), 'Project completed. Impact statistics updated.')}>Mark as completed</button><p id="completion-help" className="text-sm text-stone-600">{reason}</p></>}</div>{editing && <section className="bg-white border rounded-2xl p-6"><h2 className="text-xl font-bold mb-4">Edit project</h2><ProjectForm key={project._id} initial={project} busy={busy} onSave={async data => {
          if (await action(() => ngo.updateProject(id, data), 'Project saved.')) setEditing(false);
        }} /></section>}<div role="tablist" aria-label="Project management" className="flex gap-2 flex-wrap">{tabs.map((name, i) => <button key={name} id={`tab-${name}`} role="tab" aria-selected={tab === name} aria-controls={`panel-${name}`} tabIndex={tab === name ? 0 : -1} onKeyDown={e => {
          if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            setTab(tabs[n]);
            document.getElementById(`tab-${tabs[n]}`)?.focus();
          }
        }} onClick={() => setTab(name)} className={`rounded-xl px-4 py-2 border ${tab === name ? 'bg-brand-600 text-white' : 'bg-white'}`}>{name}{name === 'Applicants' ? ` (${applicants.length})` : ''}</button>)}</div><section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="bg-white border rounded-2xl p-6 space-y-5">{tab === 'Overview' && <><h2 className="text-xl font-bold">Project overview</h2><h3 className="font-semibold">Problem statement</h3><p className="whitespace-pre-wrap">{project.problemStatement || 'Not specified'}</p><h3 className="font-semibold">Description</h3><p className="whitespace-pre-wrap">{project.description}</p><p>Beneficiaries: <strong>{project.beneficiaries.estimatedCount}</strong> — {project.beneficiaries.description}</p><p>Required skills: {project.requiredSkills.join(', ') || 'All skills welcome'}</p><p>{project.teamMembers.length} accepted / {project.volunteersNeeded} volunteers needed · {project.contributionTracking ? project.contributionHours : project.volunteerHours || 0} recorded hours</p><p>Timeline: {project.timeline?.startDate ? new Date(project.timeline.startDate).toLocaleDateString() : 'Not set'} to {project.timeline?.expectedEndDate ? new Date(project.timeline.expectedEndDate).toLocaleDateString() : 'Not set'}</p>{project.sourceProblemId && <p>Adopted from community report: {project.sourceProblemId.title}</p>}<h3 className="font-semibold">Milestones</h3>{project.milestones.map(m => <p key={m._id}>{m.completed ? '✓' : '○'} {m.title} {m.targetDate ? `— ${new Date(m.targetDate).toLocaleDateString()}` : ''}</p>)}{!project.milestones.length && <p>No milestones set yet.</p>}<ProgressSummary projectId={project._id} refreshKey={project.updatedAt} /></>}{tab === 'Applicants' && <>{applicants.map(a => <ApplicantCard key={a._id} applicant={a} loading={busy || project.status === 'completed'} onReview={(appId, status) => action(() => ngo.reviewApplicant(id, appId, status), `Application ${status}.`)} />)}{!applicants.length && <p>No volunteer applications yet.</p>}</>}{tab === 'Team' && <><h2 className="text-xl font-bold">Accepted volunteers</h2>{project.teamMembers.map(m => <div key={m._id} className="border rounded-xl p-3"><strong>{m.name}</strong><p>{m.email}</p></div>)}{!project.teamMembers.length && <p>Accept applications to form your team.</p>}<>{project.teamId && <Link className="inline-block bg-brand-600 text-white rounded-xl px-4 py-3" to={`/teams/${project.teamId}`}>Open team workspace</Link>}</></>}{tab === 'Resources' && <PendingContributions projectId={id} onRefresh={load} />}{tab === 'Resources' && <Resources key={project.updatedAt} project={project} busy={busy} save={data => action(() => ngo.updateProjectResources(id, data), 'Resources updated.')} />}{tab === 'Photos' && <Photos project={project} busy={busy} upload={data => action(() => ngo.uploadProjectPhotos(id, data), 'Photos uploaded.')} />}</section><ProjectSkillRequests project={project} onRefresh={load} /></>}</div>;
}
function Resources({
  project,
  busy,
  save
}) {
  const [spent, setSpent] = useState(project.fundingSpent),
    [materials, setMaterials] = useState(project.materialsNeeded.map(m => ({
      _id: m._id,
      quantityReceived: m.quantityReceived
    }))),
    [note, setNote] = useState('');
  return <><h2 className="text-xl font-bold">Resource transparency</h2><ProgressSummary projectId={project._id} refreshKey={project.updatedAt} /><form className="space-y-4" onSubmit={e => {
      e.preventDefault();
      save({
        materials,
        fundingSpent: Number(spent),
        receiptNote: note
      });
    }}>{project.materialsNeeded.map((m, i) => <div key={m._id} className="space-y-2"><Field label={`${m.item}: ${m.quantityReceived} received / ${m.quantityNeeded} needed`}><input className={inputClass} type="number" min="0" step="any" required value={materials[i].quantityReceived} onChange={e => setMaterials(v => v.map((row, j) => i === j ? {
            ...row,
            quantityReceived: Number(e.target.value)
          } : row))} /></Field><progress aria-label={`${m.item} received`} className="w-full accent-teal-600" max={m.quantityNeeded} value={Math.min(m.quantityNeeded, m.quantityReceived)} /></div>)}<Field label="Total funding spent (INR)"><input type="number" step="0.01" min="0" required className={inputClass} value={spent} onChange={e => setSpent(e.target.value)} /></Field><Field label="Required note or receipt reference"><textarea required maxLength={2000} className={inputClass} value={note} onChange={e => setNote(e.target.value)} /></Field><button disabled={busy} className="bg-brand-600 text-white rounded-xl px-4 py-2 disabled:opacity-50">Save resources</button></form><h3 className="font-semibold">Update history</h3>{[...(project.resourceUpdates || [])].reverse().map(update => <div key={update._id} className="border rounded-xl p-3"><p>{update.note}</p><p className="text-sm text-stone-500">{new Date(update.createdAt).toLocaleString()} · Total spent: INR {update.fundingSpent}</p></div>)}</>;
}
function Photos({
  project,
  busy,
  upload
}) {
  const [category, setCategory] = useState('progress'),
    [files, setFiles] = useState([]);
  return <><h2 className="text-xl font-bold">Impact photos</h2><form className="flex flex-wrap gap-3 items-end" onSubmit={async e => {
      e.preventDefault();
      const element = e.currentTarget;
      const data = new FormData();
      data.append('category', category);
      files.forEach(f => data.append('photos', f));
      if (await upload(data)) {
        setFiles([]);
        element.reset();
      }
    }}><Field label="Photo stage"><select className={inputClass} value={category} onChange={e => setCategory(e.target.value)}>{['before', 'progress', 'after'].map(c => <option key={c}>{c}</option>)}</select></Field><Field label="Images (up to 6, 5 MB each)"><input required type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e => {
          e.target.setCustomValidity(e.target.files.length > 6 || [...e.target.files].some(f => f.size > 5 * 1024 * 1024) ? 'Choose up to 6 images, each at most 5 MB.' : '');
          setFiles([...e.target.files]);
        }} /></Field><button disabled={busy || !files.length} className="bg-brand-600 text-white rounded-xl px-4 py-2 disabled:opacity-50">Upload photos</button></form>{['before', 'progress', 'after'].map(stage => <div key={stage}><h3 className="font-semibold capitalize my-3">{stage}</h3><div className="grid sm:grid-cols-3 gap-3">{project.photos[stage].map((url, i) => <a key={`${url}-${i}`} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`${stage} photo ${i + 1} of ${project.title}`} className="rounded-xl object-cover w-full h-48" /></a>)}</div>{!project.photos[stage].length && <p className="text-stone-500">No {stage} photos yet.</p>}</div>)}</>;
}
