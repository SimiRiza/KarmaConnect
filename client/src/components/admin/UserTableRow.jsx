import React from 'react';
import { Link } from 'react-router-dom';
export default function UserTableRow({
  user,
  onToggle,
  busy
}) {
  const p = user.profile;
  return <article className="grid sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] gap-3 p-4 bg-white rounded-xl border items-center"><div className="min-w-0"><Link className="font-bold text-brand-800 underline" to={'/admin/users/' + user._id}>{user.name}</Link><p className="text-sm break-all">{user.email}</p></div><p className="text-sm">{user.role.replaceAll('_', ' ')}</p><p className="text-sm">{user.isSuspended ? 'Suspended' : 'Active'}{p && <span className="block text-stone-600">{user.role === 'ngo' ? (p.previousProjectsCount || 0) + ' completed projects' : user.role === 'csr_manager' ? 'INR ' + (p.totalBudgetAllocated || 0).toLocaleString('en-IN') + ' allocated' : p.subType?.replaceAll('_', ' ')}</span>}</p><button disabled={busy} onClick={() => onToggle(user)} className="text-sm border rounded-lg p-2 text-brand-800 disabled:opacity-50">{user.isSuspended ? 'Reactivate' : 'Suspend'}</button></article>;
}
