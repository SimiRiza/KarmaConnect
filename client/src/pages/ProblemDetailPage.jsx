import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Heart, HandCoins, Bookmark, BookmarkCheck, LoaderCircle } from 'lucide-react';
import * as communityService from '../services/communityService';
import StatusBadge from '../components/StatusBadge';
import ApplyModal from '../components/ApplyModal';
import ContributeModal from '../components/ContributeModal';

const pipeline = ['reported', 'team_forming', 'funding_needed', 'in_progress', 'completed'];

const ProblemDetailPage = () => {
  const { id } = useParams();
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [isApplyOpen, setApplyOpen] = useState(false);
  const [isContributionOpen, setContributionOpen] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState('');
  const [savedList, setSavedList] = useState([]);

  const loadProblem = async () => {
    try {
      const [problemRes, savedRes] = await Promise.all([
        communityService.getProblem(id),
        communityService.getSavedProblems()
      ]);
      const problemData = problemRes.data.problem;
      setProblem(problemData);
      setSavedList((savedRes.data.savedProblems || []).map((item) => item._id));
      setSaved((savedRes.data.savedProblems || []).some((item) => item._id === id));

      const myApplicationsRes = await communityService.getMyApplications();
      const myApplication = (myApplicationsRes.data.applications || []).find((item) => item.problemId?._id === id || item.problemId === id);
      setApplicationStatus(myApplication?.status || '');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProblem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleApply = async (payload) => {
    try {
      await communityService.applyToProblem(id, payload);
      setApplyOpen(false);
      setApplicationStatus('pending');
    } catch (error) {
      alert(error.response?.data?.message || 'Unable to submit application.');
    }
  };

  const handleContribution = async (payload) => {
    try {
      await communityService.contributeToProblem(id, payload);
      setContributionOpen(false);
      alert('Contribution recorded successfully.');
    } catch (error) {
      alert(error.response?.data?.message || 'Unable to record contribution.');
    }
  };

  const handleSaveToggle = async () => {
    try {
      if (saved) {
        await communityService.unsaveProblem(id);
      } else {
        await communityService.saveProblem(id);
      }
      setSaved((current) => !current);
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-brand-700">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          <span className="font-medium">Loading details…</span>
        </div>
      </div>
    );
  }

  if (!problem) {
    return <div className="px-4 py-16 text-center text-stone-600">Problem not found.</div>;
  }

  const currentStepIndex = pipeline.indexOf(problem.status) >= 0 ? pipeline.indexOf(problem.status) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={problem.status} />
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-700 border border-brand-200">
                {problem.category}
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-stone-900">{problem.title}</h1>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-2xl bg-stone-50 p-3 text-stone-700">
                <MapPin className="h-4 w-4 text-brand-600" />
                {problem.location?.city || 'Unknown city'}
                {problem.location?.area ? ` • ${problem.location.area}` : ''}
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-stone-50 p-3 text-stone-700">
                <Heart className="h-4 w-4 text-brand-600" />
                Urgency: {problem.urgency}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {problem.photos?.length ? problem.photos.map((photo, index) => (
                <img key={`${photo}-${index}`} src={photo} alt={`${problem.title} ${index + 1}`} className="h-36 w-full rounded-2xl object-cover" />
              )) : null}
            </div>

            <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <h3 className="text-lg font-bold text-stone-900">Description</h3>
              <p className="mt-3 leading-relaxed text-stone-700">{problem.description}</p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-bold text-stone-900">Status pipeline</h3>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {pipeline.map((step, index) => (
                  <div key={step} className="text-center">
                    <div className={`mx-auto h-3 w-3 rounded-full ${index <= currentStepIndex ? 'bg-brand-600' : 'bg-stone-200'}`} />
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-stone-600">{step.replace('_', ' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="border-t border-stone-200 bg-stone-50 p-4 sm:p-6 lg:border-l lg:border-t-0">
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleSaveToggle}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-100"
              >
                {saved ? <BookmarkCheck className="h-4 w-4 text-brand-700" /> : <Bookmark className="h-4 w-4" />}
                {saved ? 'Saved' : 'Save this problem'}
              </button>

              {applicationStatus ? (
                <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800 font-semibold">
                  You already applied. Status: {applicationStatus}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setApplyOpen(true)}
                  className="w-full rounded-xl bg-accent-500 px-4 py-3 text-sm font-bold text-white hover:bg-accent-600"
                >
                  I Want to Help
                </button>
              )}

              <button
                type="button"
                onClick={() => setContributionOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700"
              >
                <HandCoins className="h-4 w-4" />
                Contribute
              </button>

              <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-700 space-y-2">
                <div className="flex justify-between gap-2"><span>Estimated resources</span><span>{problem.estimatedResourcesNeeded || 'Not specified'}</span></div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <ApplyModal open={isApplyOpen} onClose={() => setApplyOpen(false)} onSubmit={handleApply} />
      <ContributeModal open={isContributionOpen} onClose={() => setContributionOpen(false)} onSubmit={handleContribution} />
    </div>
  );
};

export default ProblemDetailPage;
