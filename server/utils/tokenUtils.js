import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authSecret } from '../config/environment.js';

/**
 * Generate a short-lived JWT Access Token (15 minutes).
 * Payload contains only essential identification: id, email, role.
 */
export const generateAccessToken = (user) => {
  const secret = authSecret('JWT_SECRET', 'dev_jwt_access_secret_fallback_key');
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';

  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role
    },
    secret,
    { expiresIn, jwtid: crypto.randomBytes(16).toString('hex') }
  );
};

/**
 * Generate a longer-lived JWT Refresh Token (7 days).
 */
export const generateRefreshToken = (user) => {
  const secret = authSecret('JWT_REFRESH_SECRET', 'dev_jwt_refresh_secret_fallback_key');
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  return jwt.sign(
    {
      id: user._id.toString()
    },
    secret,
    { expiresIn }
  );
};

/**
 * Cryptographically hash a token using SHA-256 for secure DB storage.
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Verify an access token.
 */
export const verifyAccessToken = (token) => {
  const secret = authSecret('JWT_SECRET', 'dev_jwt_access_secret_fallback_key');
  return jwt.verify(token, secret);
};

/**
 * Verify a refresh token.
 */
export const verifyRefreshToken = (token) => {
  const secret = authSecret('JWT_REFRESH_SECRET', 'dev_jwt_refresh_secret_fallback_key');
  return jwt.verify(token, secret);
};

/**
 * Set the refresh token as an httpOnly, sameSite, secure cookie.
 */
export const setRefreshTokenCookie = (res, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge,
    path: '/'
  });
};

/**
 * Clear the refresh token cookie.
 */
export const clearRefreshTokenCookie = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/'
  });
};
