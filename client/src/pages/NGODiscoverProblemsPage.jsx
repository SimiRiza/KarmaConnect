import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as ngo from '../services/ngoService';
import ProblemCard from '../components/ProblemCard';
import AdoptProblemModal from '../components/AdoptProblemModal';
import { CATEGORIES, inputClass } from '../components/ProjectForm';
export default function NGODiscoverProblemsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    search: '',
    location: '',
    category: '',
    urgency: '',
    resources: '',
    sort: 'newest',
    page: 1
  });
  const [data, setData] = useState({
      items: [],
      total: 0
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(false),
    [verified, setVerified] = useState(false);
  useEffect(() => {
    ngo.getProfile().then(r => setVerified(r.data.profile.verificationStatus === 'verified')).catch(() => {});
  }, []);
  useEffect(() => {
    let live = true;
    setLoading(true);
    const timer = setTimeout(() => {
      ngo.getUnadoptedProblems({
        ...filters,
        limit: 12
      }).then(r => {
        if (live) {
          setData(r.data);
          setError('');
        }
      }).catch(e => {
        if (live) setError(e.response?.data?.message || 'Could not load problems.');
      }).finally(() => {
        if (live) setLoading(false);
      });
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [filters]);
  const set = key => e => setFilters(f => ({
    ...f,
    [key]: e.target.value,
    page: 1
  }));
  const adopt = async () => {
    setBusy(true);
    try {
      const r = await ngo.adoptProblem(selected._id, {});
      navigate(`/ngo/projects/${r.data.project._id}`);
    } catch (e) {
      setSelected(null);
      setError(e.response?.data?.message || 'Adoption failed.');
    } finally {
      setBusy(false);
    }
  };
  return <div className="max-w-6xl mx-auto p-6 space-y-6"><h1 className="text-3xl font-bold">Discover community problems</h1><p>Find an unadopted problem and turn it into a managed project.</p>{!verified && <p className="bg-amber-50 p-4 rounded-xl">You can browse now. Administrator verification is required before adopting a problem.</p>}<div className="bg-white border rounded-2xl p-4 grid sm:grid-cols-3 gap-3">{[['search', 'Search problems'], ['location', 'City'], ['resources', 'Resources needed']].map(([key, label]) => <label key={key}>{label}<input className={inputClass} value={filters[key]} onChange={set(key)} /></label>)}<label>Category<select className={inputClass} value={filters.category} onChange={set('category')}><option value="">All categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label><label>Urgency<select className={inputClass} value={filters.urgency} onChange={set('urgency')}><option value="">All urgencies</option>{['low', 'medium', 'high'].map(u => <option key={u}>{u}</option>)}</select></label><label>Sort<select className={inputClass} value={filters.sort} onChange={set('sort')}><option value="newest">Newest</option><option value="most_urgent">Most urgent</option></select></label></div>{error && <p role="alert" className="text-red-700">{error}</p>}{loading ? <p>Loading problems...</p> : <><p>{data.total} unadopted problems</p><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{data.items.map(p => <ProblemCard key={p._id} problem={p} onAdopt={setSelected} adoptDisabled={!verified} />)}</div>{!data.items.length && <p>No problems match your filters.</p>}<div className="flex gap-4 justify-center"><button disabled={filters.page <= 1} onClick={() => setFilters(f => ({
          ...f,
          page: f.page - 1
        }))}>Previous</button><span>Page {filters.page} of {Math.max(1, data.totalPages || 1)}</span><button disabled={filters.page >= data.totalPages} onClick={() => setFilters(f => ({
          ...f,
          page: f.page + 1
        }))}>Next</button></div></>}{selected && <AdoptProblemModal problem={selected} onClose={() => setSelected(null)} onConfirm={adopt} busy={busy} />}</div>;
}
