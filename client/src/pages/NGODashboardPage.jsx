import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as ngo from '../services/ngoService';
import ProjectCard from '../components/ProjectCard';
import ProblemCard from '../components/ProblemCard';
import ApplicantCard from '../components/ApplicantCard';
import AdoptProblemModal from '../components/AdoptProblemModal';
import VerificationBadge from '../components/VerificationBadge';
export default function NGODashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(null);
  const load = async () => {
    const r = await ngo.getDashboard();
    setSummary(r.data.summary);
  };
  useEffect(() => {
    load().catch(() => setError('Could not load dashboard.'));
  }, []);
  const review = async (id, status) => {
    setBusy(true);
    setError('');
    try {
      await ngo.reviewApplicant(null, id, status);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Review failed.');
    } finally {
      setBusy(false);
    }
  };
  const adopt = async () => {
    setBusy(true);
    try {
      const r = await ngo.adoptProblem(selected._id, {});
      navigate(`/ngo/projects/${r.data.project._id}`);
    } catch (e) {
      setSelected(null);
      setError(e.response?.data?.message || 'Adoption failed.');
      await load();
    } finally {
      setBusy(false);
    }
  };
  return <div className="max-w-6xl mx-auto p-6 space-y-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">NGO dashboard</h1><p className="mt-2 text-stone-600">From local problems to real impact — together.</p></div><Link to="/ngo/projects/new" className="bg-accent-500 px-4 py-3 rounded-xl text-white font-semibold">Create project</Link></div>{error && <p role="alert" className="text-red-700">{error}</p>}{!summary ? <p>Loading dashboard...</p> : <><VerificationBadge status={summary.impactStats.verificationStatus} />{summary.impactStats.verificationStatus !== 'verified' && <p className="bg-amber-50 p-4 rounded-xl">Complete your <Link to="/ngo/profile" className="underline">NGO profile</Link>. An administrator must verify your organization before you can create or adopt projects.</p>}<div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">{[['activeProjectsCount', 'Active projects'], ['newNearbyProblemsCount', 'New problems nearby'], ['pendingApplicationsCount', 'Pending applications'], ['projectsNeedingFundingCount', 'Projects needing funding'], ['completedProjectsCount', 'Completed projects']].map(([key, label]) => <div key={key} className="bg-white border rounded-2xl p-5"><p className="text-3xl font-bold text-brand-700">{summary[key]}</p><p>{label}</p></div>)}</div><div className="bg-brand-50 border border-brand-200 rounded-2xl p-5 flex flex-wrap gap-8"><p><strong>{summary.impactStats.previousProjectsCount}</strong> projects completed</p><p><strong>{summary.impactStats.totalBeneficiariesReached}</strong> beneficiaries reached</p><p><strong>{summary.impactStats.totalVolunteerHours}</strong> recorded volunteer hours</p></div><section className="space-y-4"><h2 className="text-2xl font-bold">New problems near you</h2><p className="text-stone-600">{summary.nearbyScope}</p><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{summary.nearbyProblems.map(p => <ProblemCard key={p._id} problem={p} onAdopt={setSelected} adoptDisabled={summary.impactStats.verificationStatus !== 'verified'} />)}</div>{!summary.nearbyProblems.length && <p>No new problems in this area.</p>}<Link to="/ngo/discover-problems" className="text-brand-700 underline">Discover more problems</Link></section><section className="space-y-4"><h2 className="text-2xl font-bold">My active projects</h2><div className="grid md:grid-cols-2 gap-4">{summary.activeProjects.map(p => <ProjectCard key={p._id} project={p} />)}</div>{!summary.activeProjects.length && <p>No active projects yet.</p>}</section><section className="space-y-4"><h2 className="text-2xl font-bold">Pending applications</h2>{summary.pendingApplications.map(a => <ApplicantCard key={a._id} applicant={a} onReview={review} loading={busy} />)}{!summary.pendingApplications.length && <p>No pending applications.</p>}</section></>}{selected && <AdoptProblemModal problem={selected} onClose={() => setSelected(null)} onConfirm={adopt} busy={busy} />}</div>;
}
