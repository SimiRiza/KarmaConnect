import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/authService';
import { setAccessToken as setApiAccessToken, registerAuthCallbacks } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync state when interceptor refreshes the token
  const handleTokenRefreshed = useCallback(({ accessToken: newToken, user: newUser, profile: newProfile }) => {
    setAccessToken(newToken);
    if (newUser) setUser(newUser);
    if (newProfile) setProfile(newProfile);
  }, []);

  const handleSessionExpired = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    registerAuthCallbacks({
      onTokenRefreshed: handleTokenRefreshed,
      onSessionExpired: handleSessionExpired
    });
  }, [handleTokenRefreshed, handleSessionExpired]);

  // Update in-memory token for the API service whenever accessToken state changes
  const updateAccessToken = useCallback((token) => {
    setAccessToken(token);
    setApiAccessToken(token);
  }, []);

  /**
   * Attempt to restore session using httpOnly refresh token cookie on application load.
   */
  const bootstrapSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await authService.refreshAccessToken();
      updateAccessToken(data.accessToken);
      setUser(data.user);
      setProfile(data.profile);
    } catch (err) {
      // Refresh token cookie not present or expired: user remains unauthenticated
      updateAccessToken(null);
      setUser(null);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [updateAccessToken]);

  useEffect(() => {
    bootstrapSession();
  }, [bootstrapSession]);

  /**
   * Log in user with email and password.
   */
  const login = async (email, password) => {
    const data = await authService.login(email, password);
    updateAccessToken(data.accessToken);
    setUser(data.user);
    setProfile(data.profile);
    return data;
  };

  /**
   * Register a new user with atomic profile creation.
   */
  const signup = async (signupData) => {
    const data = await authService.signup(signupData);
    if (data.accessToken) {
      updateAccessToken(data.accessToken);
      setUser(data.user);
      setProfile(data.profile);
    }
    return data;
  };

  /**
   * Log out user.
   */
  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.warn('Logout request encountered an error:', err.message);
    } finally {
      updateAccessToken(null);
      setUser(null);
      setProfile(null);
    }
  };

  /**
   * Manually trigger access token refresh.
   */
  const refresh = async () => {
    try {
      const data = await authService.refreshAccessToken();
      updateAccessToken(data.accessToken);
      setUser(data.user);
      setProfile(data.profile);
      return data;
    } catch (err) {
      updateAccessToken(null);
      setUser(null);
      setProfile(null);
      throw err;
    }
  };

  const value = {
    user,
    profile,
    setProfile,
    setUser,
    accessToken,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    login,
    signup,
    logout,
    refreshAccessToken: refresh
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
