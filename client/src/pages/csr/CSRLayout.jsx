import React, { useCallback, useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
export const panel = 'bg-white border border-stone-200 rounded-2xl p-5 space-y-4';
export function useLoad(loader, dependencies = []) {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const value = await loader();
      setData(value.data);
      return value.data;
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load this page. Please retry.');
      throw e;
    } finally {
      setLoading(false);
    }
  }, dependencies);
  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);
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
  return <div className="space-y-6"><h1 className="text-3xl font-bold">{title}</h1>{error && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">{error}</p>}{loading && <p role="status">Loading...</p>}{children}</div>;
}
export default function CSRLayout() {
  return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6"><nav aria-label="CSR navigation" className="flex flex-wrap gap-2 mb-7 border-b pb-4">{[['dashboard', 'Overview'], ['discover-projects', 'Discover projects'], ['portfolio', 'Portfolio'], ['reports', 'Reports'], ['budget', 'Budget'], ['profile', 'Company profile']].map(([path, label]) => <Link key={path} className="px-3 py-2 rounded-lg text-brand-800 hover:bg-brand-50" to={`/csr/${path}`}>{label}</Link>)}</nav><Outlet /></div>;
}
