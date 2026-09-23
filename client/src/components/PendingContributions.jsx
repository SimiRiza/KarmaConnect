import React, { useEffect, useState } from 'react';
import api from '../services/api';
import PendingContributionRow from './PendingContributionRow';
export default function PendingContributions({ projectId, onRefresh }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [page, setPage] = useState(1);
  const load = async () => { try { const r = await api.get(`/projects/${projectId}/contributions`, { params: { status: 'pending', page } }); setData(r.data); setError(''); } catch (e) { setError(e.response?.data?.message || 'Could not load pending contributions.'); } };
  useEffect(() => { load(); }, [projectId, page]);
  return <section className="space-y-4"><h2 className="text-xl font-bold">Pending contributions to confirm</h2>{error && <p role="alert" className="text-red-700">{error}</p>}{data?.items.map(c => <PendingContributionRow key={c._id} contribution={c} projectId={projectId} onReviewed={async () => { await onRefresh(); await load(); }} />)}{data && !data.total && <p>No contributions awaiting confirmation.</p>}{data?.totalPages > 1 && <div className="flex gap-4"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {data.totalPages}</span><button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button></div>}</section>;
}
