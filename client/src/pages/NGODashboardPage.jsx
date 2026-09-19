import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as ngoSvc from '../services/ngoService';
import VerificationBadge from '../components/VerificationBadge';
import {
  LayoutDashboard, Folders, Search, User, TrendingUp,
  AlertCircle, Users, CheckCircle, ArrowRight, Loader2
} from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, color = 'brand' }) => (
  <div className={`bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex items-center gap-4`}>
    <div className={`w-12 h-12 rounded-xl bg-${color}-50 text-${color}-600 flex items-center justify-center shrink-0`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className="text-2xl font-extrabold text-stone-900">{value ?? '—'}</p>
      <p className="text-xs text-stone-500 font-medium mt-0.5">{label}</p>
    </div>
  </div>
);

const NGODashboardPage = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    ngoSvc.getDashboard()
      .then((res) => setSummary(res.data.summary))
      .catch(() => setError('Could not load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-brand-600">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100">
            <LayoutDashboard className="w-8 h-8" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
                NGO Partner
              </span>
              {summary?.impactStats?.verificationStatus && (
                <VerificationBadge status={summary.impactStats.verificationStatus} />
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">{user?.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/ngo/projects/new"
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors shadow"
          >
            + New Project
          </Link>
          <Link
            to="/ngo/discover-problems"
            className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 text-xs font-semibold transition-colors"
          >
            Discover Problems
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Stat Grid */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={Folders} label="Active Projects" value={summary.activeProjectsCount} color="brand" />
          <StatCard icon={Search} label="New Nearby Problems" value={summary.newNearbyProblemsCount} color="teal" />
          <StatCard icon={Users} label="Pending Applications" value={summary.pendingApplicationsCount} color="amber" />
          <StatCard icon={AlertCircle} label="Need Funding" value={summary.projectsNeedingFundingCount} color="orange" />
          <StatCard icon={CheckCircle} label="Completed Projects" value={summary.completedProjectsCount} color="emerald" />
          <StatCard icon={TrendingUp} label="Beneficiaries Reached" value={summary.impactStats?.totalBeneficiariesReached} color="violet" />
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { to: '/ngo/projects', icon: Folders, title: 'My Projects', desc: 'Manage all your active and past projects' },
          { to: '/ngo/discover-problems', icon: Search, title: 'Discover Problems', desc: 'Browse community-reported problems to adopt' },
          { to: '/ngo/profile', icon: User, title: 'NGO Profile', desc: 'Edit your NGO details and team members' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="bg-white border border-stone-200 rounded-2xl p-5 hover:shadow-md hover:border-brand-200 transition-all group flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 group-hover:bg-brand-100 transition-colors">
              <item.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-stone-900 text-sm group-hover:text-brand-700 transition-colors">{item.title}</p>
              <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-brand-400 transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default NGODashboardPage;
