import api from './api';

/**
 * Register a new user and role-specific profile.
 */
export const signup = async (signupData) => {
  const response = await api.post('/auth/signup', signupData);
  return response.data;
};

/**
 * Log in with email and password.
 */
export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

/**
 * Log out user (clears session server-side and refresh cookie).
 */
export const logout = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};

/**
 * Refresh access token using httpOnly cookie.
 */
export const refreshAccessToken = async () => {
  const response = await api.post('/auth/refresh');
  return response.data;
};

/**
 * Verify email address with token from verification link.
 */
export const verifyEmail = async (token) => {
  const response = await api.get(`/auth/verify-email/${token}`);
  return response.data;
};

/**
 * Request password reset link.
 */
export const forgotPassword = async (email) => {
  const response = await api.post('/auth/forgot-password', { email });
  return response.data;
};

/**
 * Reset password with new password and token.
 */
export const resetPassword = async (token, password) => {
  const response = await api.post(`/auth/reset-password/${token}`, { password });
  return response.data;
};

/**
 * Fetch authenticated user info and profile.
 */
export const getMe = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};
