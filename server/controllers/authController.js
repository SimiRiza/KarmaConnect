import * as authService from '../services/authService.js';
import { setRefreshTokenCookie, clearRefreshTokenCookie } from '../utils/tokenUtils.js';

/**
 * @desc    Register a new user (Community User, NGO, or CSR Manager) and create their role profile
 * @route   POST /api/auth/signup
 * @access  Public
 * @param   {import('express').Request} req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 */
export const signup = async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);

    if (result.refreshToken) {
      setRefreshTokenCookie(res, result.refreshToken);
    }

    res.status(201).json({
      success: true,
      message: result.isEmailVerificationRequired
        ? 'Account created successfully! Please check your email to verify your account.'
        : 'Account created and activated successfully!',
      user: result.user,
      profile: result.profile,
      ...(result.accessToken ? { accessToken: result.accessToken } : {}),
      isEmailVerificationRequired: result.isEmailVerificationRequired
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify user email using token sent via email
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 * @param   {import('express').Request} req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 */
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    await authService.verifyUserEmail(token);

    res.status(200).json({
      success: true,
      message: 'Your email address has been verified successfully. You may now log in.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user with email & password, issue access token & refresh cookie
 * @route   POST /api/auth/login
 * @access  Public
 * @param   {import('express').Request} req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);

    setRefreshTokenCookie(res, result.refreshToken);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: result.user,
      profile: result.profile,
      accessToken: result.accessToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Refresh access token using httpOnly refresh token cookie
 * @route   POST /api/auth/refresh
 * @access  Public (requires valid httpOnly cookie)
 * @param   {import('express').Request} req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 */
export const refresh = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    const result = await authService.refreshSession(rawRefreshToken);

    res.status(200).json({
      success: true,
      accessToken: result.accessToken,
      user: result.user,
      profile: result.profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Log out user by clearing the refresh cookie and removing token from DB
 * @route   POST /api/auth/logout
 * @access  Public
 * @param   {import('express').Request} req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 */
export const logout = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    const userId = req.user?._id;

    await authService.logoutUser(rawRefreshToken, userId);
    clearRefreshTokenCookie(res);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Request password reset link for forgotten password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 * @param   {import('express').Request} req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password using token from email, invalidating all other sessions
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 * @param   {import('express').Request} req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const result = await authService.resetPassword(token, password);
    clearRefreshTokenCookie(res);

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get currently logged in user info and role profile
 * @route   GET /api/auth/me
 * @access  Private (Requires valid access token)
 * @param   {import('express').Request} req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 */
export const getMe = async (req, res, next) => {
  try {
    const result = await authService.getCurrentUser(req.user._id);

    res.status(200).json({
      success: true,
      user: result.user,
      profile: result.profile
    });
  } catch (error) {
    next(error);
  }
};
