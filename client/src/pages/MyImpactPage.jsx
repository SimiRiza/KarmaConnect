import React, { useEffect, useState } from 'react';
import * as communityService from '../services/communityService';

const MyImpactPage = () => {
  const [impact, setImpact] = useState({
    problemsParticipatedIn: { count: 0, list: [] },
    totalContributionsByType: {},
    totalMoneyContributed: 0,
    completedProjectsCount: 0,
    completedProjects: []
  });

  useEffect(() => {
    const load = async () => {
      try {
        const response = await communityService.getMyImpact();
        setImpact(response.data.impact || {});
      } catch (error) {
        console.error(error);
      }
    };
    load();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">My impact</p>
        <h1 className="mt-2 text-3xl font-extrabold text-stone-900">Contribution dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Problems helped</p>
          <p className="mt-3 text-3xl font-extrabold text-brand-700">{impact.problemsParticipatedIn?.count || 0}</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Total money</p>
          <p className="mt-3 text-3xl font-extrabold text-brand-700">₹{Number(impact.totalMoneyContributed || 0)}</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Completed projects</p>
          <p className="mt-3 text-3xl font-extrabold text-brand-700">{impact.completedProjectsCount || 0}</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Contribution types</p>
          <p className="mt-3 text-3xl font-extrabold text-brand-700">{Object.keys(impact.totalContributionsByType || {}).length}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-stone-900">Contribution breakdown</h2>
          <div className="mt-4 space-y-2">
            {Object.entries(impact.totalContributionsByType || {}).length === 0 ? (
              <p className="text-sm text-stone-600">No contributions recorded yet.</p>
            ) : Object.entries(impact.totalContributionsByType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between rounded-2xl bg-stone-50 p-3 text-sm text-stone-700">
                <span className="font-medium capitalize">{type}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-stone-900">Completed projects</h2>
          <div className="mt-4 space-y-3">
            {(impact.completedProjects || []).length === 0 ? (
              <p className="text-sm text-stone-600">No completed projects yet.</p>
            ) : impact.completedProjects.map((project) => (
              <div key={project._id} className="rounded-2xl border border-stone-200 p-3">
                <p className="font-semibold text-stone-900">{project.title}</p>
                <p className="text-xs text-stone-500">{project.category}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyImpactPage;
