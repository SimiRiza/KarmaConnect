import api from './api';

// ── NGO Profile ──────────────────────────────────────────────
export const getDashboard = () => api.get('/ngo/dashboard');
export const getProfile = () => api.get('/ngo/profile');
export const updateProfile = (payload) => api.put('/ngo/profile', payload);

// ── Discover Problems ────────────────────────────────────────
export const getUnadoptedProblems = (params = {}) =>
  api.get('/ngo/discover-problems', { params });

// ── Adopt Problem ────────────────────────────────────────────
export const adoptProblem = (problemId, payload) =>
  api.post(`/ngo/problems/${problemId}/adopt`, payload);

// ── Projects ─────────────────────────────────────────────────
export const createProject = (payload) => api.post('/ngo/projects', payload);
export const getProjects = (params = {}) => api.get('/ngo/projects', { params });
export const getProjectById = (id) => api.get(`/ngo/projects/${id}`);
export const updateProject = (id, payload) => api.put(`/ngo/projects/${id}`, payload);
export const updateProjectStatus = (id, status) =>
  api.patch(`/ngo/projects/${id}/status`, { status });
export const completeProject = (id) => api.post(`/ngo/projects/${id}/complete`);
export const updateProjectResources = (id, payload) =>
  api.put(`/ngo/projects/${id}/resources`, payload);
export const uploadProjectPhotos = (id, payload) =>
  api.post(`/ngo/projects/${id}/photos`, payload);

// ── Applicants ───────────────────────────────────────────────
export const getApplicants = (projectId) =>
  api.get(`/ngo/projects/${projectId}/applicants`);
export const reviewApplicant = (projectId, appId, status) =>
  api.patch(`/ngo/projects/${projectId}/applicants/${appId}`, { status });
