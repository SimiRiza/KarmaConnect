import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for login requests to mitigate brute-force attacks.
 * Max 10 requests per 15 minutes window per IP.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter for forgot-password requests to prevent email spamming.
 * Max 5 requests per hour window per IP.
 */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    success: false,
    message: 'Too many password reset requests from this IP. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
