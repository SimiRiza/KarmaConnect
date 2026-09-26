import AsyncState from '../components/AsyncState';
import React, { useEffect, useState } from 'react';
import * as communityService from '../services/communityService';
import ProblemCard from '../components/ProblemCard';
import EmptyState from '../components/EmptyState';

const SavedPage = () => {
  const [problems, setProblems] = useState([]);

  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const loadSaved = async () => {
    setLoading(true);setError('');
    try {
      const response = await communityService.getSavedProblems();
      setProblems(response.data.savedProblems || []);
    } catch (error) {
      setError('Could not load saved opportunities.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    loadSaved();
  }, []);

  const handleToggleSave = async (problemId) => {
    try {
      await communityService.unsaveProblem(problemId);
      setProblems((current) => current.filter((problem) => problem._id !== problemId));
    } catch (error) {
      setError('Could not remove this saved opportunity. Please retry.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Saved projects</p>
        <h1 className="mt-2 text-3xl font-extrabold text-stone-900">Your saved opportunities</h1>
      </div>

      <AsyncState loading={loading} error={error} onRetry={loadSaved}>
      {problems.length === 0 ? (
        <EmptyState title="No saved projects" message="Save a problem from the Discover page to keep it here." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {problems.map((problem) => (
            <ProblemCard key={problem._id} problem={problem} saved={true} onToggleSave={handleToggleSave} />
          ))}
        </div>
      )}
      </AsyncState>
    </div>
  );
};

export default SavedPage;
