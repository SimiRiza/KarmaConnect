import axios from 'axios';

// Create base Axios instance with cookie credentials enabled
const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Crucial for sending and receiving httpOnly refresh cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

// In-memory token management (NOT stored in localStorage to protect against XSS)
let inMemoryAccessToken = null;
let onTokenRefreshedCallback = null;
let onSessionExpiredCallback = null;

export const setAccessToken = (token) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = () => {
  return inMemoryAccessToken;
};

export const registerAuthCallbacks = ({ onTokenRefreshed, onSessionExpired }) => {
  onTokenRefreshedCallback = onTokenRefreshed;
  onSessionExpiredCallback = onSessionExpired;
};

// Request Interceptor: Attach Access Token to Authorization header if present
api.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Seamless token refresh on 401 response
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Do not attempt refresh on the refresh endpoint itself or login/signup
    const isAuthEndpoint = originalRequest.url?.includes('/auth/login') ||
                           originalRequest.url?.includes('/auth/signup') ||
                           originalRequest.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Queue the request until current refresh cycle finishes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call refresh endpoint (httpOnly cookie automatically included)
        const response = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const newAccessToken = response.data.accessToken;
        const updatedUser = response.data.user;
        const updatedProfile = response.data.profile;

        setAccessToken(newAccessToken);

        if (onTokenRefreshedCallback) {
          onTokenRefreshedCallback({ accessToken: newAccessToken, user: updatedUser, profile: updatedProfile });
        }

        processQueue(null, newAccessToken);

        // Retry the original failed request with the new access token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);

        if (onSessionExpiredCallback) {
          onSessionExpiredCallback();
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
