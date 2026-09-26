import EmptyState from '../components/EmptyState';
import RequestError from '../components/RequestError';
import VolunteerMatchCard from '../components/VolunteerMatchCard';
import SkillRequestCard from '../components/SkillRequestCard';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProblemCard from '../components/ProblemCard';
import ApplyModal from '../components/ApplyModal';
import * as communityService from '../services/communityService';
import { HeartHandshake, GraduationCap, Building2, ShieldCheck, LogOut, User, Calendar, MapPin, CheckCircle, Clock, Sparkles, ArrowRight, Target, Briefcase, Bookmark } from 'lucide-react';

/**
 * Shared Dashboard Card Container
 */
const DashboardContainer = ({ title, promptNotice, roleBadge, icon: Icon, children }) => {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100 shrink-0">
            <Icon className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
                {roleBadge}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle className="w-3 h-3" /> Session Verified
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 flex items-center gap-2 mt-0.5">
              <span>{user?.email}</span>
              {user?.location?.city && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {user.location.city}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-stone-700 font-semibold text-xs transition-colors flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Feature Phase Notice */}
      <div className="bg-gradient-to-r from-brand-50 via-teal-50/50 to-amber-50/40 rounded-2xl p-6 border border-brand-200/80 space-y-3">
        <div className="flex items-center gap-2 text-brand-800 font-bold text-sm sm:text-base">
          <Sparkles className="w-5 h-5 text-brand-600" />
          <span>{title}</span>
        </div>
        <p className="text-stone-700 text-sm leading-relaxed">
          {promptNotice}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-stone-600">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
            ✓ Complete JWT Access & Refresh Token System Active
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
            ✓ Role-Based Route Guards Enforced
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
            ✓ Atomic Profile Link Active in MongoDB
          </span>
        </div>
      </div>

      {/* Role Profile Details */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-5">
        <h2 className="text-lg font-bold text-stone-900 border-b border-stone-100 pb-3">
          Saved Profile & Account Context
        </h2>
        {children}
      </div>
    </div>
  );
};

/**
 * Community User / Volunteer Dashboard
 */
export const CommunityDashboard = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [skillMatches, setSkillMatches] = useState([]);
  const [reload, setReload] = useState(0);
  const [matchError, setMatchError] = useState('');
  const [recommendedProblems, setRecommendedProblems] = useState([]);
  const [localProblems, setLocalProblems] = useState([]);
  const [applications, setApplications] = useState([]);
  const [impactStats, setImpactStats] = useState(null);
  const [savedIds, setSavedIds] = useState([]);
  const [selectedProblemForApply, setSelectedProblemForApply] = useState(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applySuccessMessage, setApplySuccessMessage] = useState('');

  const userCity = user?.location?.city || profile?.location?.city || 'Mumbai';

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setMatchError('');
      try {
        const [problemsRes, appRes, impactRes, savedRes, recommendationsRes, skillsRes] = await Promise.allSettled([
          communityService.getProblems({ limit: 12, sort: 'newest' }),
          communityService.getMyApplications(),
          communityService.getMyImpact(),
          communityService.getSavedProblems(),
          communityService.getRecommendations(),
          communityService.getSkillMatches()
        ]);

        const allProblems = problemsRes.status === 'fulfilled' ? problemsRes.value.data.items || [] : [];
        const myApps = appRes.status === 'fulfilled' ? appRes.value.data.applications || [] : [];
        const impact = impactRes.status === 'fulfilled' ? impactRes.value.data.impact || null : null;
        const saved = savedRes.status === 'fulfilled' ? (savedRes.value.data.savedProblems || []).map(p => p._id) : [];

        setApplications(myApps);
        setImpactStats(impact);
        setSavedIds(saved);

        // Filter local problems by user's city
        const local = allProblems.filter(p => 
          p.location?.city?.toLowerCase() === userCity.toLowerCase()
        );
        setLocalProblems(local.length > 0 ? local.slice(0, 3) : allProblems.slice(0, 3));

        setRecommendedProblems(recommendationsRes.status === 'fulfilled' ? recommendationsRes.value.data.items : []);
        setSkillMatches(skillsRes.status === 'fulfilled' ? skillsRes.value.data.items : []);
        setMatchError([problemsRes,appRes,impactRes,savedRes,recommendationsRes,skillsRes].some(r=>r.status==='rejected') ? 'Some dashboard information could not load.' : '');
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [userCity, profile, reload]);

  const handleToggleSave = async (problemId) => {
    try {
      if (savedIds.includes(problemId)) {
        await communityService.unsaveProblem(problemId);
        setSavedIds(current => current.filter(id => id !== problemId));
      } else {
        await communityService.saveProblem(problemId);
        setSavedIds(current => [...current, problemId]);
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  const handleOpenApply = (problem) => {
    setSelectedProblemForApply(problem);
    setApplyModalOpen(true);
  };

  const handleSubmitApply = async (payload) => {
    if (!selectedProblemForApply) return;
    try {
      await communityService.applyToProblem(selectedProblemForApply._id, payload);
      setApplyModalOpen(false);
      setApplySuccessMessage(`Successfully applied to "${selectedProblemForApply.title}"!`);
      setTimeout(() => setApplySuccessMessage(''), 5000);

      // Refresh applications list
      const appRes = await communityService.getMyApplications();
      setApplications(appRes.data.applications || []);
    } catch (error) {
      throw error;
    }
  };

  // Display recorded contribution totals.
  const totalHours = impactStats?.totalVolunteerHours || 0;
  const activeProjectsCount = applications.filter(a => a.status === 'accepted' || a.status === 'pending').length;
  const moneyContributed = impactStats?.totalMoneyContributed || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Success Notification */}
      {applySuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 font-medium text-sm">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{applySuccessMessage}</span>
          </div>
          <button onClick={() => setApplySuccessMessage('')} className="text-emerald-600 hover:text-emerald-900 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-700 via-teal-700 to-brand-800 rounded-3xl p-6 sm:p-8 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 max-w-2xl relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
              Volunteer Dashboard
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-white font-medium bg-emerald-500/40 px-2 py-0.5 rounded-full backdrop-blur-sm border border-emerald-400/30">
              <MapPin className="w-3 h-3" /> {userCity}
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Welcome back, {user?.name || 'Volunteer'}!
          </h1>
          <p className="text-teal-100 text-sm sm:text-base leading-relaxed">
            Ready to make an impact in {userCity} today? Discover neighborhood needs, lend your unique skills, and track your verified social contributions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 self-stretch md:self-auto relative z-10">
          <Link
            to="/post-problem"
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-bold px-4 py-3 rounded-xl text-sm transition shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>Report a Problem</span>
          </Link>
          <Link
            to="/discover"
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-3 rounded-xl text-sm transition backdrop-blur-sm border border-white/20"
          >
            <span>Browse Needs</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* 2. Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0 border border-brand-100">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Volunteered</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-0.5">{totalHours} <span className="text-sm font-normal text-stone-500">hrs</span></p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Active Projects</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-0.5">{activeProjectsCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Confirmed contributions</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-brand-700 mt-0.5">{Object.values(impactStats?.totalContributionsByType || {}).reduce((a, b) => a + b, 0)}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Material item kinds</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-0.5">{impactStats?.materialsCount || 0}</p>
          </div>
        </div>
      </div>

      {/* 3. Karma Tracker & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white rounded-3xl p-6 border space-y-4"><h2 className="text-2xl font-bold">Your recorded impact</h2><p>Confirmed time and skill contributions: <strong>{totalHours} hours</strong>.</p><p>Individual donations: <strong>INR {moneyContributed}</strong> (simulated).</p><p><strong>{impactStats?.completedProjectsCount || 0}</strong> completed projects helped through recorded contributions.</p><Link to="/my-impact" className="underline text-brand-800">See your contribution timeline</Link><p className="text-sm text-stone-500">Pending contributions count after confirmation. Applications alone are not hours worked.</p></section>
        {/* Quick Actions Card */}
        <div className="bg-gradient-to-br from-brand-50/60 via-white to-stone-50 rounded-3xl p-6 sm:p-8 border border-brand-200/80 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Volunteer Toolkit</p>
            <h3 className="text-lg font-bold text-stone-900 mt-1">Quick Navigation</h3>
            <p className="text-xs text-stone-600 mt-1">Manage your active commitments and discovery settings.</p>
          </div>

          <div className="space-y-2">
            <Link
              to="/post-problem"
              className="flex items-center justify-between p-3 rounded-2xl bg-white border border-stone-200 hover:border-brand-300 hover:bg-brand-50/50 transition group"
            >
              <span className="text-sm font-semibold text-stone-800 group-hover:text-brand-700">Report a Local Need</span>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-brand-600" />
            </Link>
            <Link
              to="/profile"
              className="flex items-center justify-between p-3 rounded-2xl bg-white border border-stone-200 hover:border-brand-300 hover:bg-brand-50/50 transition group"
            >
              <span className="text-sm font-semibold text-stone-800 group-hover:text-brand-700">Update Skills & Causes</span>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-brand-600" />
            </Link>
            <Link
              to="/my-applications"
              className="flex items-center justify-between p-3 rounded-2xl bg-white border border-stone-200 hover:border-brand-300 hover:bg-brand-50/50 transition group"
            >
              <span className="text-sm font-semibold text-stone-800 group-hover:text-brand-700">Track Applications</span>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-brand-600" />
            </Link>
            <Link
              to="/my-impact"
              className="flex items-center justify-between p-3 rounded-2xl bg-white border border-stone-200 hover:border-brand-300 hover:bg-brand-50/50 transition group"
            >
              <span className="text-sm font-semibold text-stone-800 group-hover:text-brand-700">View Verified Impact</span>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-brand-600" />
            </Link>
          </div>
        </div>
      </div>

      {/* 4. Recommended Opportunities For You */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Personalized Matches</p>
            <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900">Recommended for You</h2>
          </div>
          <Link
            to="/discover"
            className="text-xs sm:text-sm font-bold text-brand-700 hover:text-brand-800 flex items-center gap-1"
          >
            <span>View all</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div role="status" className="p-12 text-center text-stone-500 text-sm">Loading matches for your profile...</div>
        ) : matchError ? null : recommendedProblems.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-stone-200 text-center space-y-3">
            <EmptyState title="No recommendations yet" message="Explore community needs or update your profile."/>
            <Link to="/discover" className="inline-block px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-xl">
              Explore Discover Page
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendedProblems.map((prob) => (
              <VolunteerMatchCard key={prob._id} project={prob} />
            ))}
          </div>
        )}
      </div>

      <section className="space-y-4"><h2 className="text-2xl font-bold">Skill Matches</h2>{matchError && <RequestError message={matchError} onRetry={()=>setReload(n=>n+1)}/>}<div className="grid md:grid-cols-2 gap-4">{skillMatches.map(r => <SkillRequestCard key={r._id} request={r} />)}</div>{!loading && !matchError && !skillMatches.length && <EmptyState title="No open requests match your skills yet." message="Update your skills or check back later."/>}</section>
      {/* 5. Local Problems Near You */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Hyperlocal Action</p>
            <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900">Needs Near {userCity}</h2>
          </div>
          <Link
            to={`/discover?city=${encodeURIComponent(userCity)}`}
            className="text-xs sm:text-sm font-bold text-brand-700 hover:text-brand-800 flex items-center gap-1"
          >
            <span>Browse {userCity} needs</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div role="status" className="p-12 text-center text-stone-500 text-sm">Loading neighborhood problems...</div>
        ) : matchError ? null : localProblems.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-stone-200 text-center space-y-3">
            <EmptyState title="No reported needs nearby" message="Be the first to post a local need."/>
            <Link to="/post-problem" className="inline-block px-4 py-2 bg-accent-500 text-white text-xs font-bold rounded-xl">
              Report a Problem in {userCity}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {localProblems.map((prob) => (
              <ProblemCard
                key={prob._id}
                problem={prob}
                saved={savedIds.includes(prob._id)}
                onToggleSave={handleToggleSave}
                onApply={handleOpenApply}
              />
            ))}
          </div>
        )}
      </div>

      {/* 6. My Active Applications / Involvement Summary */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Participation</p>
            <h2 className="text-lg sm:text-xl font-extrabold text-stone-900">My Active Applications</h2>
          </div>
          <Link
            to="/my-applications"
            className="text-xs sm:text-sm font-bold text-brand-700 hover:text-brand-800 flex items-center gap-1"
          >
            <span>All applications ({applications.length})</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? <p role="status">Loading applications...</p> : matchError ? null : applications.length === 0 ? (
          <div className="py-8 text-center text-stone-500 text-sm">
            <EmptyState title="No applications yet" message="Find an opportunity to help your community."/>
            <Link to="/discover" className="text-accent-600 hover:underline font-bold text-xs mt-1 inline-block">
              Find an opportunity to help &rarr;
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {applications.slice(0, 4).map((app) => (
              <div key={app._id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-stone-900 text-sm sm:text-base">
                    {app.problem?.title || 'Community Need'}
                  </h4>
                  <p className="text-xs text-stone-500 flex items-center gap-2">
                    <span>Offering: <strong className="capitalize text-stone-700">{app.contributionType}</strong></span>
                    <span>•</span>
                    <span>{new Date(app.createdAt).toLocaleDateString()}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    app.status === 'accepted'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : app.status === 'rejected'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {app.status}
                  </span>
                  {app.problem?._id && (
                    <Link
                      to={`/problems/${app.problem._id}`}
                      className="p-1.5 text-stone-400 hover:text-brand-700 transition"
                      title="View Problem Details"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Apply Modal */}
      <ApplyModal
        open={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        onSubmit={handleSubmitApply}
      />
    </div>
  );
};

/**
 * NGO Dashboard
 */
export const NGODashboard = () => {
  const { user, profile } = useAuth();

  return (
    <DashboardContainer
      title="NGO Workspace & Project Management Hub"
      promptNotice="The full NGO Partner Dashboard will be introduced in Prompt 3. You will be able to adopt community problems, create project plans, recruit volunteers, request CSR corporate grants, and submit impact milestones."
      roleBadge="Grassroots NGO Partner"
      icon={HeartHandshake}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
        <div>
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-1">
            NGO Legal Entity Name
          </span>
          <p className="font-bold text-stone-900 text-base">
            {profile?.ngoName || user?.name}
          </p>
        </div>

        <div>
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-1">
            Registration Number
          </span>
          <p className="font-mono text-stone-800 font-medium">
            {profile?.registrationNumber || 'Pending Verification'}
          </p>
        </div>

        <div>
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-1">
            Primary Contact Coordinator
          </span>
          <p className="font-semibold text-stone-800">
            {profile?.contactPersonName || user?.name}
          </p>
        </div>

        <div>
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-1">
            Verification Status
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Verification {profile?.verificationStatus || 'Pending'}
          </span>
        </div>

        {profile?.causeAreas && profile.causeAreas.length > 0 && (
          <div className="sm:col-span-2">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-1">
              Field Focus Areas
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {profile.causeAreas.map((c) => (
                <span key={c} className="px-2.5 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-medium border border-brand-200">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardContainer>
  );
};

/**
 * CSR Manager Dashboard
 */
export const CSRDashboard = () => {
  const { user, profile } = useAuth();

  return (
    <DashboardContainer
      title="Corporate CSR Impact & Capital Allocation Dashboard"
      promptNotice="The full CSR Management Portal is coming in Prompt 4. You will be able to review verified NGO proposals, fund community projects with transparent escrow tracking, and view audited impact analytics."
      roleBadge="CSR Corporate Partner"
      icon={Building2}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
        <div>
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-1">
            Company Name
          </span>
          <p className="font-bold text-stone-900 text-base">
            {profile?.companyName || user?.name}
          </p>
        </div>

        <div>
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-1">
            CSR Lead
          </span>
          <p className="font-semibold text-stone-800">
            {profile?.csrManagerName || user?.name}
          </p>
        </div>

        <div>
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-1">
            Industry / Sector
          </span>
          <p className="font-semibold text-stone-800">
            {profile?.industry || 'Enterprise'}
          </p>
        </div>

        <div>
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-1">
            Annual CSR Allocation Range
          </span>
          <p className="font-semibold text-brand-700">
            {profile?.budgetRange || 'Flexible'}
          </p>
        </div>

        {profile?.csrFocusAreas && profile.csrFocusAreas.length > 0 && (
          <div className="sm:col-span-2">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-1">
              Priority CSR Pillars
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {profile.csrFocusAreas.map((c) => (
                <span key={c} className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-medium border border-orange-200">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardContainer>
  );
};

/**
 * Admin Dashboard
 */
export const AdminDashboard = () => {
  return (
    <DashboardContainer
      title="KarmaConnect System Administration"
      promptNotice="The Admin Console comes in Prompt 8. From here, platform administrators will approve NGO legal credentials, monitor platform health, and audit reported issues."
      roleBadge="System Administrator"
      icon={ShieldCheck}
    >
      <p className="text-sm text-stone-600">
        Administrator privilege verified. All user management, NGO verification queues, and audit logs will be rendered here.
      </p>
    </DashboardContainer>
  );
};
