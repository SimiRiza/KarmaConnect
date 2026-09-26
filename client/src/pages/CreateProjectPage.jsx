import RequestError from '../components/RequestError';
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as ngo from '../services/ngoService';
import ProjectForm from '../components/ProjectForm';
export default function CreateProjectPage() {
  const {
    state
  } = useLocation();
  const source = state?.sourceProblem;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [verified, setVerified] = useState(null);
  useEffect(() => {
    ngo.getProfile().then(r => setVerified(r.data.profile.verificationStatus === 'verified')).catch(e => setError(e.response?.data?.message || 'Could not load verification status.'));
  }, []);
  const save = async data => {
    setBusy(true);
    setError('');
    try {
      const result = source ? await ngo.adoptProblem(source._id, data) : await ngo.createProject(data);
      navigate(`/ngo/projects/${result.data.project._id}`);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save project.');
    } finally {
      setBusy(false);
    }
  };
  return <div className="max-w-4xl mx-auto p-6 space-y-6"><Link className="text-brand-700" to="/ngo/projects">Back to projects</Link><h1 className="text-3xl font-bold">{source ? 'Adopt and plan your project' : 'Create a project'}</h1>{source && <p>Adopting “{source.title}” creates a managed project and links it to the original community problem when you submit this form.</p>}{error && <RequestError message={error} />}{verified === false ? <p className="bg-amber-50 border border-amber-200 rounded-xl p-4">Your NGO needs administrator verification before creating or adopting projects. <Link to="/ngo/profile" className="underline">Review your profile</Link>.</p> : verified === null ? <p>Checking verification...</p> : <div className="bg-white border rounded-2xl p-6"><ProjectForm initial={source || {}} onSave={save} busy={busy} submitLabel={source ? 'Adopt and create project' : 'Create project'} /></div>}</div>;
}
