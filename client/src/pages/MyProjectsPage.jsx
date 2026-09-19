import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as ngoSvc from '../services/ngoService';
import ProjectCard from '../components/ProjectCard';
import { Plus, Loader2, AlertCircle, Filter } from 'lucide-react';

const STATUS_FILTERS = [
  { value: '', label: 'All Projects' },
  { value: 'reported', label: 'Reported' },
  { value: 'adopted', label: 'Adopted' },
  { value: 'team_forming', label: 'Team Forming' },
  { value: 'funding_needed', label: 'Funding Needed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const MyProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const res = await ngoSvc.getProjects(params);
      setProjects(res.data.projects || []);
    } catch {
      setError('Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">My Projects</h1>
          <p className="text-sm text-stone-500 mt-1">Manage all projects across your lifecycle pipeline</p>
        </div>
        <Link
          to="/ngo/projects/new"
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors shadow"
        >
          <Plus className="w-4 h-4" /> New Project
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
              statusFilter === f.value
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:text-brand-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-brand-600">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="font-bold text-stone-600">No projects found.</p>
          <p className="text-sm text-stone-400 mt-1">
            {statusFilter ? 'Try a different status filter.' : 'Create your first project or adopt a community problem.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <Link to="/ngo/projects/new" className="text-sm font-semibold text-brand-700 hover:underline">+ New Project</Link>
            <span className="text-stone-300">|</span>
            <Link to="/ngo/discover-problems" className="text-sm font-semibold text-brand-700 hover:underline">Discover Problems</Link>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-stone-400">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p._id} project={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default MyProjectsPage;
