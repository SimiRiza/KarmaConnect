import api from './api';
export const getProfile = () => api.get('/csr/me/profile');
export const updateProfile = data => api.put('/csr/me/profile', data);
export const discover = params => api.get('/csr/projects', {
  params
});
export const match = data => api.post('/csr/match-projects', data);
export const detail = id => api.get(`/csr/projects/${id}`);
export const fund = (id, data, key) => api.post(`/csr/projects/${id}/fund`, data, {
  headers: {
    'Idempotency-Key': key
  }
});
export const fundings = params => api.get('/csr/fundings', {
  params
});
export const funding = id => api.get(`/csr/fundings/${id}`);
export const withdraw = id => api.patch(`/csr/fundings/${id}/withdraw`);
export const progress = id => api.get(`/csr/projects/${id}/progress`);
export const report = id => api.get(`/csr/reports/${id}`);
export const portfolio = () => api.get('/csr/reports/portfolio');
export const dashboard = () => api.get('/csr/dashboard-summary');

export const recommendations = () => api.get('/csr/me/recommended-projects', { params: { limit: 6 } });
