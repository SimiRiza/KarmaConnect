import NotificationsPage from './pages/NotificationsPage';
import ImpactStoriesPage from './pages/ImpactStoriesPage';
import ImpactStoryPage from './pages/ImpactStoryPage';
import TeamWorkspacePage from './pages/TeamWorkspacePage';
import CommunityProjectPage from './pages/CommunityProjectPage';
import CSRLayout from './pages/csr/CSRLayout';
import CSRDashboardPage from './pages/csr/CSRDashboardPage';
import CSRProfilePage from './pages/csr/CSRProfilePage';
import CSRDiscoverPage from './pages/csr/CSRDiscoverPage';
import CSREvaluationPage from './pages/csr/CSREvaluationPage';
import CSRPortfolioPage from './pages/csr/CSRPortfolioPage';
import CSRMonitorPage from './pages/csr/CSRMonitorPage';
import CSRReportsPage from './pages/csr/CSRReportsPage';
import CSRBudgetPage from './pages/csr/CSRBudgetPage';
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import NGODashboardPage from './pages/NGODashboardPage';
import NGOProfilePage from './pages/NGOProfilePage';
import NGODiscoverProblemsPage from './pages/NGODiscoverProblemsPage';
import CreateProjectPage from './pages/CreateProjectPage';
import MyProjectsPage from './pages/MyProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DiscoverPage from './pages/DiscoverPage';
import ProblemDetailPage from './pages/ProblemDetailPage';
import PostProblemPage from './pages/PostProblemPage';
import ProfilePage from './pages/ProfilePage';
import MyApplicationsPage from './pages/MyApplicationsPage';
import MyImpactPage from './pages/MyImpactPage';
import SavedPage from './pages/SavedPage';
import {
  CommunityDashboard,
  AdminDashboard
} from './pages/Dashboards';
import ProtectedRoute from './components/ProtectedRoute';
import RoleProtectedRoute from './components/RoleProtectedRoute';

export const App = () => {
  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      <Navbar />

      <main className="flex-grow">
        <Routes>
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/teams/:id" element={<ProtectedRoute><TeamWorkspacePage /></ProtectedRoute>} />
          <Route path="/projects/:id" element={<RoleProtectedRoute allowedRoles={['community_user']}><CommunityProjectPage /></RoleProtectedRoute>} />
          <Route path="/impact-stories" element={<ProtectedRoute><ImpactStoriesPage /></ProtectedRoute>} />
          <Route path="/impact-stories/:id" element={<ProtectedRoute><ImpactStoryPage /></ProtectedRoute>} />
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route
            path="/discover"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['community_user']}>
                  <DiscoverPage />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/problems/:id"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['community_user']}>
                  <ProblemDetailPage />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/post-problem"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['community_user']}>
                  <PostProblemPage />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['community_user']}>
                  <ProfilePage />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/my-applications"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['community_user']}>
                  <MyApplicationsPage />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/my-impact"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['community_user']}>
                  <MyImpactPage />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/saved"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['community_user']}>
                  <SavedPage />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          />

          {/* Role-Protected Dashboard Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['community_user']}>
                  <CommunityDashboard />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/ngo/dashboard"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['ngo']}>
                  <NGODashboardPage />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          />

          <Route element={<RoleProtectedRoute allowedRoles={['csr_manager']} />}>
            <Route path="/csr" element={<CSRLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<CSRDashboardPage />} />
              <Route path="profile" element={<CSRProfilePage />} />
              <Route path="discover-projects" element={<CSRDiscoverPage />} />
              <Route path="projects/:id" element={<CSREvaluationPage />} />
              <Route path="projects/:id/monitor" element={<CSRMonitorPage />} />
              <Route path="portfolio" element={<CSRPortfolioPage />} />
              <Route path="reports" element={<CSRReportsPage />} />
              <Route path="budget" element={<CSRBudgetPage />} />
              <Route path="*" element={<Navigate to="/csr/dashboard" replace />} />
            </Route>
          </Route>

          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          />

          <Route element={<RoleProtectedRoute allowedRoles={['ngo']} />}>
            <Route path="/ngo/profile" element={<NGOProfilePage />} />
            <Route path="/ngo/discover-problems" element={<NGODiscoverProblemsPage />} />
            <Route path="/ngo/projects/new" element={<CreateProjectPage />} />
            <Route path="/ngo/projects" element={<MyProjectsPage />} />
            <Route path="/ngo/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/ngo/*" element={<Navigate to="/ngo/dashboard" replace />} />
          </Route>
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
};

export default App;
