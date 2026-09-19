import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HeartHandshake, User, LogOut, LayoutDashboard, Menu, X } from 'lucide-react';

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'ngo': return '/ngo/dashboard';
      case 'csr_manager': return '/csr/dashboard';
      case 'admin': return '/admin/dashboard';
      default: return '/dashboard';
    }
  };

  const getRoleLabel = () => {
    if (!user) return '';
    switch (user.role) {
      case 'community_user': return 'Volunteer / Citizen';
      case 'ngo': return 'NGO Partner';
      case 'csr_manager': return 'CSR Partner';
      case 'admin': return 'Admin';
      default: return user.role;
    }
  };

  return (
    <nav className="sticky top-0 z-50 glass-nav border-b border-canvas-border transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Tagline */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-md shadow-brand-600/20 group-hover:bg-brand-700 transition-colors">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-stone-900 group-hover:text-brand-700 transition-colors">
                KarmaConnect
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-brand-700 -mt-1 hidden sm:block">
                Community Impact Platform
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/#how-it-works" className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">
              How It Works
            </Link>
            <Link to={user?.role === "ngo" ? "/ngo/discover-problems" : "/discover"} className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">
              Explore Projects
            </Link>
          </div>

          {/* Desktop Auth Controls */}
          <div className="hidden md:flex items-center space-x-3">
            {isAuthenticated && user ? (
              <div className="flex items-center space-x-3">
                <Link
                  to={getDashboardPath()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4 text-brand-600" />
                  <span>Dashboard</span>
                  <span className="text-xs bg-brand-100 text-brand-800 px-2 py-0.5 rounded-full font-semibold">
                    {getRoleLabel()}
                  </span>
                </Link>
                <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
                  <span className="text-xs text-stone-600 font-medium">{user.name}</span>
                  <button
                    onClick={handleLogout}
                    title="Log Out"
                    className="p-1.5 rounded-lg text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-semibold text-stone-700 hover:text-brand-700 px-3 py-2 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold shadow-sm transition-all hover:shadow-md hover:shadow-accent-500/20"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-stone-600 hover:bg-stone-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {user?.role === 'ngo' && <div className="flex flex-wrap justify-center gap-5 border-t px-4 py-2 text-sm text-brand-800" aria-label="NGO navigation">{[['/ngo/dashboard', 'Overview'], ['/ngo/discover-problems', 'Discover'], ['/ngo/projects', 'My projects'], ['/ngo/profile', 'NGO profile']].map(([path, label]) => <Link key={path} to={path}>{label}</Link>)}</div>}
      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-stone-200 bg-white px-4 pt-3 pb-5 space-y-3">
          <Link
            to="/#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-stone-700 font-medium"
          >
            How It Works
          </Link>
          <Link
            to={user?.role === "ngo" ? "/ngo/discover-problems" : "/discover"}
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-stone-700 font-medium"
          >
            Explore Projects
          </Link>
          <div className="pt-3 border-t border-stone-100">
            {isAuthenticated && user ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Logged in as {user.name} ({getRoleLabel()})
                </div>
                <Link
                  to={getDashboardPath()}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-brand-700 font-semibold"
                >
                  <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
                </Link>
                <button
                  onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                  className="flex items-center gap-2 py-2 text-red-600 font-medium"
                >
                  <LogOut className="w-4 h-4" /> Log Out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 rounded-lg border border-stone-300 text-stone-700 font-medium"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 rounded-lg bg-accent-500 text-white font-semibold"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
