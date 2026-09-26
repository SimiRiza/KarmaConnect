import React from 'react';
export default function RequestError({
  message,
  onRetry = () => window.location.reload()
}) {
  return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"><p>{message}</p><button type="button" onClick={() => Promise.resolve(onRetry()).catch(() => {})} className="underline font-semibold mt-2">Retry</button></div>;
}
