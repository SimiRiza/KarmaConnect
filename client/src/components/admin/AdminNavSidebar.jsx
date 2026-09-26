import React from 'react';
import { NavLink } from 'react-router-dom';
export default function AdminNavSidebar() {
  return <aside className="bg-brand-900 text-white p-4 lg:min-h-[calc(100vh-4rem)]"><p className="text-xs tracking-widest uppercase text-brand-200 mb-4">KarmaConnect control panel</p><nav aria-label="Admin navigation" className="flex flex-wrap gap-2 lg:flex-col">{[['dashboard', 'Overview'], ['verifications', 'Verifications'], ['reports', 'Reports'], ['users', 'Users'], ['categories', 'Categories'], ['project-verification', 'Project evidence']].map(([route, label]) => <NavLink key={route} to={'/admin/' + route} className={({
        isActive
      }) => 'rounded-lg px-3 py-2 text-sm ' + (isActive ? 'bg-white text-brand-900 font-bold' : 'hover:bg-brand-800')}>{label}</NavLink>)}</nav></aside>;
}
