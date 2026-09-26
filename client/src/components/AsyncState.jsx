import React from 'react';
import EmptyState from './EmptyState';
export default function AsyncState({
  loading,
  error,
  onRetry,
  empty = false,
  emptyTitle = 'Nothing here yet',
  children
}) {
  if (loading) return <div role="status" className="p-6 text-stone-600 flex gap-3 items-center"><span className="w-5 h-5 border-2 border-brand-200 border-t-brand-700 rounded-full animate-spin" />Loading...</div>;
  if (error) return <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800"><p>{error}</p>{onRetry && <button type="button" onClick={() => Promise.resolve(onRetry()).catch(() => {})} className="mt-3 underline font-semibold">Retry</button>}</div>;
  if (empty) return <EmptyState title={emptyTitle} message="Try different filters or check back after activity has been recorded." />;
  return children;
}
