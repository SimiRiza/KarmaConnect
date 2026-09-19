import React, { useEffect, useState } from 'react';
import * as csr from '../../services/csrService';
import CSRProjectCard from '../../components/CSRProjectCard';
import SkillsChipInput from '../../components/SkillsChipInput';
import { CATEGORIES, inputClass } from '../../components/ProjectForm';
import { Page, panel } from './CSRLayout';
export default function CSRDiscoverPage() {
  const [filters, setFilters] = useState({
    category: '',
    location: '',
    fundingMin: '',
    fundingMax: '',
    verificationStatus: '',
    beneficiariesMin: '',
    beneficiariesMax: '',
    urgency: '',
    timelineMonths: '',
    includeFullyFunded: false,
    page: 1
  });
  const [data, setData] = useState(null),
    [matches, setMatches] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [matching, setMatching] = useState(false);
  const [matchForm, setMatchForm] = useState({
    focusAreas: [],
    location: '',
    budgetMin: '',
    budgetMax: '',
    timelineMonths: ''
  });
  useEffect(() => {
    let current = true;
    setLoading(true);
    const timer = setTimeout(() => {
      csr.discover(filters).then(r => {
        if (current) {
          setData(r.data);
          setError('');
        }
      }).catch(e => {
        if (current) setError(e.response?.data?.message || 'Could not load projects.');
      }).finally(() => {
        if (current) setLoading(false);
      });
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [filters]);
  const set = (key, value) => setFilters(f => ({
    ...f,
    [key]: value,
    page: 1
  }));
  const findMatches = async e => {
    e.preventDefault();
    setMatching(true);
    setError('');
    try {
      const r = await csr.match(matchForm);
      setMatches(r.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not find matches.');
    } finally {
      setMatching(false);
    }
  };
  return <Page title="Discover projects" error={error}><section className={panel}><h2 className="text-xl font-bold">Find matching projects</h2><p className="text-stone-600">Filter by your focus areas, budget and timeline. These are simple matches, not a scored recommendation system.</p><form onSubmit={findMatches} className="space-y-4"><SkillsChipInput label="Focus areas" value={matchForm.focusAreas} onChange={focusAreas => setMatchForm(f => ({
          ...f,
          focusAreas
        }))} placeholder="e.g. education, environment" /><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{[['location', 'Location'], ['budgetMin', 'Minimum budget (INR)'], ['budgetMax', 'Maximum budget (INR)'], ['timelineMonths', 'Maximum months']].map(([key, label]) => <label key={key}>{label}<input type={key === 'location' ? 'text' : 'number'} min="0" step="any" className={inputClass} value={matchForm[key]} onChange={e => setMatchForm(f => ({
              ...f,
              [key]: e.target.value
            }))} /></label>)}</div><button disabled={matching} className="bg-brand-600 text-white px-4 py-3 rounded-xl">{matching ? 'Finding matches...' : 'Find matching projects'}</button></form></section>{matches && <section className="space-y-4"><h2 className="text-2xl font-bold">Best matches ({matches.total})</h2><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{matches.items.map(p => <CSRProjectCard key={p._id} project={p} />)}</div>{!matches.total && <p>No projects match these criteria.</p>}<button className="underline" onClick={() => setMatches(null)}>Clear matches</button></section>}<div className="grid lg:grid-cols-[250px_1fr] gap-6"><aside className={`${panel} self-start`}><h2 className="font-bold text-xl">Browse filters</h2><label className="block">Category<select className={inputClass} value={filters.category} onChange={e => set('category', e.target.value)}><option value="">All categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>{[['location', 'City or area'], ['fundingMin', 'Minimum required (INR)'], ['fundingMax', 'Maximum required (INR)'], ['beneficiariesMin', 'Minimum beneficiaries'], ['beneficiariesMax', 'Maximum beneficiaries'], ['timelineMonths', 'Maximum duration (months)']].map(([key, label]) => <label key={key} className="block">{label}<input className={inputClass} type={key === 'location' ? 'text' : 'number'} min="0" step="any" value={filters[key]} onChange={e => set(key, e.target.value)} /></label>)}<label className="block">NGO verification<select className={inputClass} value={filters.verificationStatus} onChange={e => set('verificationStatus', e.target.value)}><option value="">Any status</option>{['verified', 'pending', 'rejected'].map(v => <option key={v}>{v}</option>)}</select></label><label className="block">Urgency<select className={inputClass} value={filters.urgency} onChange={e => set('urgency', e.target.value)}><option value="">Any urgency</option>{['low', 'medium', 'high'].map(v => <option key={v}>{v}</option>)}</select></label><label className="flex gap-2"><input type="checkbox" checked={filters.includeFullyFunded} onChange={e => set('includeFullyFunded', e.target.checked)} /> Include fully funded projects</label></aside><section className="space-y-4 min-w-0">{loading ? <p>Loading projects...</p> : data && <><p>{data.total} projects found</p><div className="grid md:grid-cols-2 gap-4">{data.items.map(p => <CSRProjectCard key={p._id} project={p} />)}</div>{!data.total && <p>No projects match your filters.</p>}<div className="flex gap-4 items-center"><button disabled={filters.page <= 1} onClick={() => setFilters(f => ({
              ...f,
              page: f.page - 1
            }))}>Previous</button><span>Page {filters.page} of {Math.max(1, data.totalPages)}</span><button disabled={filters.page >= data.totalPages} onClick={() => setFilters(f => ({
              ...f,
              page: f.page + 1
            }))}>Next</button></div></>}</section></div></Page>;
}
