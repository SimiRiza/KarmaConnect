import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, LoaderCircle } from 'lucide-react';
import * as communityService from '../services/communityService';
import ProblemCard from '../components/ProblemCard';
import EmptyState from '../components/EmptyState';

const categories = ['cleaning', 'repair', 'environment', 'education', 'elderly_support', 'animal_welfare', 'health', 'other'];

const DiscoverPage = () => {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ city: '', category: '', urgency: '', status: '', needsFunding: false });
  const [page, setPage] = useState(1);
  const [savedIds, setSavedIds] = useState([]);

  const fetchProblems = async (nextPage = 1, nextFilters = filters) => {
    setLoading(true);
    try {
      const params = {
        page: nextPage,
        limit: 9,
        city: nextFilters.city || undefined,
        category: nextFilters.category || undefined,
        urgency: nextFilters.urgency || undefined,
        status: nextFilters.needsFunding ? 'funding_needed' : nextFilters.status || undefined,
        sort: 'newest'
      };
      const response = await communityService.getProblems(params);
      let items = response.data.items || [];
      if (search.trim()) {
        const term = search.toLowerCase();
        items = items.filter((problem) => `${problem.title} ${problem.description}`.toLowerCase().includes(term));
      }
      setProblems(items);
    } catch (error) {
      setProblems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadSaved = async () => {
      try {
        const response = await communityService.getSavedProblems();
        setSavedIds((response.data.savedProblems || []).map((problem) => problem._id));
      } catch (error) {
        setSavedIds([]);
      }
    };
    loadSaved();
    fetchProblems(1, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProblems(1, filters);
    }, 250);
    return () => clearTimeout(timer);
  }, [filters, search]);

  const handleToggleSave = async (problemId) => {
    try {
      if (savedIds.includes(problemId)) {
        await communityService.unsaveProblem(problemId);
        setSavedIds((current) => current.filter((id) => id !== problemId));
      } else {
        await communityService.saveProblem(problemId);
        setSavedIds((current) => [...current, problemId]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Discover</p>
          <h1 className="mt-2 text-3xl font-extrabold text-stone-900">Community impact opportunities</h1>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or keyword"
            className="w-full rounded-xl border border-stone-300 bg-white py-3 pl-10 pr-4 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2 text-stone-800">
            <Filter className="h-4 w-4 text-brand-600" />
            <h2 className="text-lg font-bold">Filters</h2>
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700">City</label>
              <input
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                placeholder="e.g. Bengaluru"
                className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700">Urgency</label>
              <select
                value={filters.urgency}
                onChange={(e) => setFilters({ ...filters, urgency: e.target.value })}
                className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                <option value="">All urgencies</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                <option value="">All statuses</option>
                <option value="reported">Reported</option>
                <option value="team_forming">Team Forming</option>
                <option value="funding_needed">Funding Needed</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                checked={filters.needsFunding}
                onChange={(e) => setFilters({ ...filters, needsFunding: e.target.checked })}
                className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
              />
              Needs funding
            </label>
          </div>
        </aside>

        <div className="space-y-5">
          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-stone-200 bg-white">
              <div className="flex items-center gap-3 text-brand-700">
                <LoaderCircle className="h-5 w-5 animate-spin" />
                <span className="font-medium">Loading problems…</span>
              </div>
            </div>
          ) : problems.length === 0 ? (
            <EmptyState
              title="No problems match your filters"
              message="Try a broader search or post a new community problem to get support."
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {problems.map((problem) => (
                <ProblemCard
                  key={problem._id}
                  problem={problem}
                  saved={savedIds.includes(problem._id)}
                  onToggleSave={handleToggleSave}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscoverPage;
