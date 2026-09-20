import api from './api';

export const getProfile = () => api.get('/users/me/profile');
export const updateProfile = (payload) => api.put('/users/me/profile', payload);
export const getMyApplications = () => api.get('/users/me/applications');
export const getMyImpact = () => api.get('/users/me/impact');
export const getSavedProblems = () => api.get('/users/me/saved');

export const getProblems = (params = {}) => api.get('/problems', { params });
export const getProblem = (id) => api.get(`/problems/${id}`);
export const createProblem = (payload) => api.post('/problems', payload);
export const uploadProblemPhotos = (formData) => api.post('/problems/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const applyToProblem = (id, payload) => api.post(`/problems/${id}/apply`, payload);
export const getApplicants = (id) => api.get(`/problems/${id}/applicants`);
export const contributeToProblem = (id, payload) => api.post(`/problems/${id}/contribute`, payload);
export const saveProblem = (id) => api.post(`/problems/${id}/save`);
export const unsaveProblem = (id) => api.delete(`/problems/${id}/save`);

export const getRecommendations = () => api.get('/users/me/recommended-projects', { params: { limit: 6 } });
export const getSkillMatches = () => api.get('/users/me/skill-matches');
