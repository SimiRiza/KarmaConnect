import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminNavSidebar from '../../components/admin/AdminNavSidebar';
export default function AdminLayout() {
  return <div className="max-w-screen-2xl mx-auto lg:grid lg:grid-cols-[230px_minmax(0,1fr)]"><AdminNavSidebar /><div className="min-w-0 px-4 sm:px-7 py-8"><Outlet /></div></div>;
}
