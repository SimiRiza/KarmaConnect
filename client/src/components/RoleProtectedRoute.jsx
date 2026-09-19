import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

/**
 * Route guard that restricts access to specific account roles.
 * Prevents e.g. community users from rendering /ngo/dashboard or /csr/dashboard.
 */
export const RoleProtectedRoute = ({ allowedRoles = [], children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-stone-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Determine the user's correct home dashboard
    let fallbackPath = '/dashboard';
    if (user.role === 'ngo') fallbackPath = '/ngo/dashboard';
    if (user.role === 'csr_manager') fallbackPath = '/csr/dashboard';
    if (user.role === 'admin') fallbackPath = '/admin/dashboard';

    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas p-6">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-stone-200 shadow-sm text-center">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 mb-2">Access Restricted</h2>
          <p className="text-stone-600 text-sm mb-6">
            Your account ({user.role}) does not have permission to view this section.
            Only accounts with roles <strong>{allowedRoles.join(', ')}</strong> can access this page.
          </p>
          <a
            href={fallbackPath}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            Go to Your Dashboard
          </a>
        </div>
      </div>
    );
  }

  return children ? children : <Outlet />;
};

export default RoleProtectedRoute;
