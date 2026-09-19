import React, { useEffect, useState } from 'react';
import * as communityService from '../services/communityService';
import ProblemCard from '../components/ProblemCard';
import EmptyState from '../components/EmptyState';

const SavedPage = () => {
  const [problems, setProblems] = useState([]);

  const loadSaved = async () => {
    try {
      const response = await communityService.getSavedProblems();
      setProblems(response.data.savedProblems || []);
    } catch (error) {
      setProblems([]);
    }
  };

  useEffect(() => {
    loadSaved();
  }, []);

  const handleToggleSave = async (problemId) => {
    try {
      await communityService.unsaveProblem(problemId);
      setProblems((current) => current.filter((problem) => problem._id !== problemId));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Saved projects</p>
        <h1 className="mt-2 text-3xl font-extrabold text-stone-900">Your saved opportunities</h1>
      </div>

      {problems.length === 0 ? (
        <EmptyState title="No saved projects" message="Save a problem from the Discover page to keep it here." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {problems.map((problem) => (
            <ProblemCard key={problem._id} problem={problem} saved={true} onToggleSave={handleToggleSave} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedPage;
