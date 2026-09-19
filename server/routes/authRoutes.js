import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { loginLimiter, forgotPasswordLimiter } from '../middleware/rateLimiter.js';
import {
  validateSignup,
  validateLogin,
  validateForgotPassword,
  validateResetPassword
} from '../middleware/validators.js';

const router = Router();

// Registration
router.post('/signup', validateSignup, authController.signup);

// Email verification
router.get('/verify-email/:token', authController.verifyEmail);

// Login (with rate limiting and input validation)
router.post('/login', loginLimiter, validateLogin, authController.login);

// Refresh access token via httpOnly cookie
router.post('/refresh', authController.refresh);

// Logout (invalidates refresh token and clears cookie)
router.post('/logout', authController.logout);

// Forgot Password (with rate limiting and validation)
router.post('/forgot-password', forgotPasswordLimiter, validateForgotPassword, authController.forgotPassword);

// Reset Password
router.post('/reset-password/:token', validateResetPassword, authController.resetPassword);

// Get current user profile (protected route)
router.get('/me', authenticate, authController.getMe);

export default router;
