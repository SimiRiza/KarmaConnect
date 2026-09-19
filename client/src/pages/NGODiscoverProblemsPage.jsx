import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as ngoSvc from '../services/ngoService';
import { MapPin, AlertCircle, Search, Filter, ChevronLeft, ChevronRight, Loader2, ArrowRight } from 'lucide-react';

const CATEGORIES = ['cleaning', 'repair', 'environment', 'education', 'elderly_support', 'animal_welfare', 'health', 'other'];
const URGENCY_OPTS = ['low', 'medium', 'high'];

const CAT_LABEL = {
  cleaning: 'Cleaning', repair: 'Repair', environment: 'Environment',
  education: 'Education', elderly_support: 'Elderly Support',
  animal_welfare: 'Animal Welfare', health: 'Health', other: 'Other',
};

const URGENCY_COLOR = {
  low: 'text-blue-700 bg-blue-50 border-blue-200',
  medium: 'text-amber-700 bg-amber-50 border-amber-200',
  high: 'text-red-700 bg-red-50 border-red-200',
};

const ProblemRow = ({ problem, onAdopt }) => (
  <div className="bg-white border border-stone-200 rounded-2xl p-5 hover:shadow-md hover:border-brand-200 transition-all group">
    <div className="flex items-start justify-between gap-3 mb-2">
      <h3 className="font-bold text-stone-900 text-sm group-hover:text-brand-700 transition-colors">{problem.title}</h3>
      <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${URGENCY_COLOR[problem.urgency] || ''}`}>
        {problem.urgency} urgency
      </span>
    </div>
    <p className="text-xs text-stone-500 mb-3 line-clamp-2">{problem.description}</p>
    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-400 mb-4">
      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{problem.location?.city}{problem.location?.area ? `, ${problem.location.area}` : ''}</span>
      <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{CAT_LABEL[problem.category] || problem.category}</span>
      <span>{new Date(problem.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
    </div>
    {problem.estimatedResourcesNeeded && (
      <p className="text-xs text-stone-500 bg-stone-50 rounded-lg px-3 py-2 border border-stone-100 mb-3 line-clamp-1">
        Resources needed: {problem.estimatedResourcesNeeded}
      </p>
    )}
    <button
      onClick={() => onAdopt(problem._id)}
      className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-2 rounded-xl transition-colors shadow"
    >
      Adopt This Problem <ArrowRight className="w-3.5 h-3.5" />
    </button>
  </div>
);

const DiscoverProblemsPage = () => {
  const navigate = useNavigate();
  const [problems, setProblems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adoptingId, setAdoptingId] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', category: '', urgency: '', city: '', page: 1 });

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.category) params.category = filters.category;
      if (filters.urgency) params.urgency = filters.urgency;
      if (filters.city) params.city = filters.city;
      params.page = filters.page;
      params.limit = 12;

      const res = await ngoSvc.getUnadoptedProblems(params);
      setProblems(res.data.problems || []);
      setTotal(res.data.total || 0);
    } catch {
      setError('Could not load problems.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchProblems(); }, [fetchProblems]);

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value, page: 1 }));

  const handleAdopt = async (problemId) => {
    if (!window.confirm('Adopt this community problem and convert it to a managed project?')) return;
    setAdoptingId(problemId);
    try {
      const res = await ngoSvc.adoptProblem(problemId, {});
      const project = res.data.project;
      navigate(`/ngo/projects/${project._id}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to adopt problem.');
    } finally {
      setAdoptingId(null);
    }
  };

  const totalPages = Math.ceil(total / 12);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-stone-900">Discover Community Problems</h1>
        <p className="text-sm text-stone-500 mt-1">Browse unadopted problems reported by the community. Adopt one to convert it into a managed project.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm flex flex-wrap gap-3">
        <div className="flex-1 min-w-[180px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search problems…"
            value={filters.search}
            onChange={setFilter('search')}
            className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition"
          />
        </div>
        <select value={filters.category} onChange={setFilter('category')}
          className="border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-700 focus:outline-none focus:border-brand-400 transition bg-white">
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
        </select>
        <select value={filters.urgency} onChange={setFilter('urgency')}
          className="border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-700 focus:outline-none focus:border-brand-400 transition bg-white">
          <option value="">All Urgencies</option>
          {URGENCY_OPTS.map((u) => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
        </select>
        <input
          type="text"
          placeholder="Filter by city"
          value={filters.city}
          onChange={setFilter('city')}
          className="border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition"
        />
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* Results count */}
      {!loading && (
        <p className="text-xs text-stone-500">{total} unadopted {total === 1 ? 'problem' : 'problems'} found</p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-brand-600">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
      ) : problems.length === 0 ? (
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="font-bold text-stone-600">No problems match your filters.</p>
          <p className="text-sm text-stone-400 mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {problems.map((p) => (
            <ProblemRow
              key={p._id}
              problem={p}
              onAdopt={adoptingId ? () => {} : handleAdopt}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
            disabled={filters.page <= 1}
            className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50 disabled:opacity-40 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-stone-600 font-medium">Page {filters.page} of {totalPages}</span>
          <button
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            disabled={filters.page >= totalPages}
            className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50 disabled:opacity-40 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default DiscoverProblemsPage;
