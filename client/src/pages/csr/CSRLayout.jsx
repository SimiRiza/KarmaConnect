import React, { useCallback, useEffect, useState, useRef } from 'react';
import RequestError from '../../components/RequestError';
import { Link, Outlet } from 'react-router-dom';
export const panel = 'bg-white border border-stone-200 rounded-2xl p-5 space-y-4';
export function useLoad(loader, dependencies = []) {
  const generation = useRef(0);
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async (background = false) => {
    const ticket = ++generation.current;
    setError('');
    if (!background) setLoading(true);
    try {
      const value = await loader();
      if (ticket === generation.current) setData(value.data);
      return value.data;
    } catch (e) {
      if (ticket === generation.current) setError(e.response?.data?.message || 'Could not load this page. Please retry.');
      throw e;
    } finally {
      if (ticket === generation.current) setLoading(false);
    }
  }, dependencies);
  useEffect(() => {
    refresh().catch(() => {});
    return () => { generation.current++; };
  }, [refresh]);
  useEffect(() => { const update = () => refresh(true).catch(() => {}); window.addEventListener('trust-refresh', update); return () => window.removeEventListener('trust-refresh', update); }, [refresh]);
  return {
    data,
    error,
    setError,
    loading,
    refresh
  };
}
export function Page({
  title,
  children,
  error,
  loading
}) {
  return <div className="space-y-6"><h1 className="text-3xl font-bold">{title}</h1>{error && <RequestError message={error} />}{loading && <p role="status">Loading...</p>}{!loading && children}</div>;
}
export default function CSRLayout() {
  return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6"><nav aria-label="CSR navigation" className="flex flex-wrap gap-2 mb-7 border-b pb-4">{[['dashboard', 'Overview'], ['discover-projects', 'Discover projects'], ['portfolio', 'Portfolio'], ['reports', 'Reports'], ['budget', 'Budget'], ['profile', 'Company profile']].map(([path, label]) => <Link key={path} className="px-3 py-2 rounded-lg text-brand-800 hover:bg-brand-50" to={`/csr/${path}`}>{label}</Link>)}</nav><Outlet /></div>;
}
