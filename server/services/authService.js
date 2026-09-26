import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import CommunityUserProfile from '../models/CommunityUserProfile.js';
import NGOProfile from '../models/NGOProfile.js';
import CSRProfile from '../models/CSRProfile.js';
import { runInTransaction } from '../utils/transactionHelper.js';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  hashToken, 
  verifyRefreshToken 
} from '../utils/tokenUtils.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/emailService.js';

/**
 * Fetch the role-specific profile document for a given user.
 */
export const getProfileByRole = async (userId, role) => {
  switch (role) {
    case 'community_user':
      return await CommunityUserProfile.findOne({ userId });
    case 'ngo':
      return await NGOProfile.findOne({ userId });
    case 'csr_manager':
      return await CSRProfile.findOne({ userId });
    default:
      return null;
  }
};

/**
 * Register a new user and create their role profile atomically.
 */
export const registerUser = async (signupData) => {
  const {
    name,
    email,
    password,
    role,
    phone,
    location,
    // Community User fields
    subType,
    skills,
    interests,
    causeAreas,
    availability,
    bio,
    collegeOrOrganization,
    // NGO fields
    ngoName,
    registrationNumber,
    registrationDocumentUrl,
    locationsServed,
    about,
    contactPersonName,
    contactPhone,
    // CSR fields
    companyName,
    csrManagerName,
    industry,
    csrFocusAreas,
    budgetRange,
    companyWebsite
  } = signupData;

  if (!['community_user', 'ngo', 'csr_manager'].includes(role)) throw Object.assign(new Error('Invalid signup role.'), { statusCode: 400 });
  // Check if email already registered
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    const error = new Error('An account with this email address already exists.');
    error.statusCode = 409;
    throw error;
  }

  // Hash password with 12 salt rounds
  const passwordHash = await bcrypt.hash(password, 12);

  // Generate email verification token
  const rawVerificationToken = crypto.randomBytes(32).toString('hex');
  const hashedVerificationToken = hashToken(rawVerificationToken);
  const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  let createdUser = null;
  let createdProfile = null;

  // Execute User + Profile creation in a transaction (with standalone fallback)
  await runInTransaction(
    async (session) => {
      const opts = session ? { session } : {};

      // 1. Create User
      const [user] = await User.create(
        [
          {
            name,
            email: email.toLowerCase(),
            passwordHash,
            role,
            phone: phone || '',
            location: location || { city: '', state: '', coordinates: [0, 0] },
            isEmailVerified: false,
            emailVerificationToken: hashedVerificationToken,
            emailVerificationExpiry: verificationExpiry
          }
        ],
        opts
      );

      createdUser = user;

      // 2. Create role-specific profile linked to User
      if (role === 'community_user') {
        const [profile] = await CommunityUserProfile.create(
          [
            {
              userId: user._id,
              subType,
              skills: Array.isArray(skills) ? skills : [],
              interests: Array.isArray(interests) ? interests : [],
              causeAreas: Array.isArray(causeAreas) ? causeAreas : [],
              availability: availability || '',
              bio: bio || '',
              collegeOrOrganization: collegeOrOrganization || ''
            }
          ],
          opts
        );
        createdProfile = profile;
      } else if (role === 'ngo') {
        const [profile] = await NGOProfile.create(
          [
            {
              userId: user._id,
              ngoName,
              registrationNumber,
              registrationDocumentUrl: registrationDocumentUrl || '',
              causeAreas: Array.isArray(causeAreas) ? causeAreas : [],
              locationsServed: Array.isArray(locationsServed) ? locationsServed : [],
              about: about || '',
              contactPersonName: contactPersonName || '',
              contactPhone: contactPhone || '',
              verificationStatus: 'pending'
            }
          ],
          opts
        );
        createdProfile = profile;
      } else if (role === 'csr_manager') {
        const [profile] = await CSRProfile.create(
          [
            {
              userId: user._id,
              companyName,
              csrManagerName,
              industry: industry || '',
              csrFocusAreas: Array.isArray(csrFocusAreas) ? csrFocusAreas : [],
              budgetRange: budgetRange || '',
              companyWebsite: companyWebsite || '',
              verificationStatus: 'pending'
            }
          ],
          opts
        );
        createdProfile = profile;
      }

      return { user: createdUser, profile: createdProfile };
    },
    async () => {
      // Compensating rollback for standalone MongoDB if profile creation fails
      if (createdUser?._id) {
        await User.findByIdAndDelete(createdUser._id);
      }
    }
  );

  // Send verification email
  await sendVerificationEmail(createdUser.email, rawVerificationToken, createdUser.name);

  const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

  let accessToken = null;
  let refreshToken = null;

  if (!requireVerification) {
    // If verification is not strictly required, issue tokens immediately
    accessToken = generateAccessToken(createdUser);
    refreshToken = generateRefreshToken(createdUser);

    const hashedRefreshToken = hashToken(refreshToken);
    await User.findByIdAndUpdate(createdUser._id, {
      $push: { refreshTokens: hashedRefreshToken }
    });
  }

  return {
    user: createdUser,
    profile: createdProfile,
    accessToken,
    refreshToken,
    isEmailVerificationRequired: requireVerification
  };
};

/**
 * Verify account using verification token.
 */
export const verifyUserEmail = async (token) => {
  const hashedToken = hashToken(token);

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: { $gt: new Date() }
  });

  if (!user) {
    const error = new Error('Verification token is invalid or has expired.');
    error.statusCode = 400;
    throw error;
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpiry = undefined;
  await user.save();

  return { user };
};

/**
 * Log in a user with email and password.
 */
export const loginUser = async (email, password) => {
  // Query user with passwordHash and refreshTokens
  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+passwordHash +refreshTokens');

  if (!user) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  if (user.isSuspended) throw Object.assign(new Error('Your account is suspended. Please contact an administrator.'), { statusCode: 403, code: 'ACCOUNT_SUSPENDED' });
  // Check email verification requirement
  const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
  if (requireVerification && !user.isEmailVerified) {
    const error = new Error('Please verify your email before logging in. Check your inbox for the verification link.');
    error.statusCode = 403;
    error.code = 'EMAIL_NOT_VERIFIED';
    throw error;
  }

  // Issue tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Store hashed refresh token on user (keep max 10 devices/sessions)
  const hashedRefreshToken = hashToken(refreshToken);
  const updatedTokens = [...(user.refreshTokens || []), hashedRefreshToken].slice(-10);

  const stored = await User.updateOne({ _id: user._id, isSuspended: { $ne: true } }, { $set: { refreshTokens: updatedTokens } });
  if (!stored.matchedCount) throw Object.assign(new Error('Your account is suspended.'), { statusCode: 403 });

  const profile = await getProfileByRole(user._id, user.role);

  return {
    user,
    profile,
    accessToken,
    refreshToken
  };
};

/**
 * Refresh access token using httpOnly refresh token.
 */
export const refreshSession = async (rawRefreshToken) => {
  if (!rawRefreshToken) {
    const error = new Error('Refresh token missing.');
    error.statusCode = 401;
    throw error;
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(rawRefreshToken);
  } catch (err) {
    const error = new Error('Invalid or expired refresh token. Please log in again.');
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findById(decoded.id).select('+refreshTokens');
  if (!user) {
    const error = new Error('User no longer exists.');
    error.statusCode = 401;
    throw error;
  }

  if (user.isSuspended) throw Object.assign(new Error('Your account is suspended.'), { statusCode: 403, code: 'ACCOUNT_SUSPENDED' });
  const hashedIncoming = hashToken(rawRefreshToken);
  if (!user.refreshTokens || !user.refreshTokens.includes(hashedIncoming)) {
    const error = new Error('Session has expired or was revoked. Please log in again.');
    error.statusCode = 401;
    throw error;
  }

  // Issue new access token
  const accessToken = generateAccessToken(user);
  const profile = await getProfileByRole(user._id, user.role);

  return {
    user,
    profile,
    accessToken
  };
};

/**
 * Log out user by removing their current refresh token from DB.
 */
export const logoutUser = async (rawRefreshToken, userId) => {
  if (rawRefreshToken) {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      try {
        const decoded = verifyRefreshToken(rawRefreshToken);
        resolvedUserId = decoded?.id;
      } catch (err) {
        // Token might already be malformed or expired
      }
    }
    const hashed = hashToken(rawRefreshToken);
    if (resolvedUserId) {
      await User.findByIdAndUpdate(resolvedUserId, {
        $pull: { refreshTokens: hashed }
      });
    } else {
      await User.updateMany(
        { refreshTokens: hashed },
        { $pull: { refreshTokens: hashed } }
      );
    }
  }
};

/**
 * Request password reset token.
 */
export const forgotPassword = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = hashToken(rawResetToken);
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = hashedResetToken;
    user.passwordResetExpiry = resetExpiry;
    await user.save();

    await sendPasswordResetEmail(user.email, rawResetToken, user.name);
  }

  // Always return generic success to prevent email enumeration
  return {
    message: 'If an account with that email exists, a password reset link has been sent.'
  };
};

/**
 * Reset password using token. Invalidates all active sessions.
 */
export const resetPassword = async (token, newPassword) => {
  const hashedToken = hashToken(token);

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpiry: { $gt: new Date() }
  }).select('+passwordHash +refreshTokens');

  if (!user) {
    const error = new Error('Password reset token is invalid or has expired.');
    error.statusCode = 400;
    throw error;
  }

  // Hash new password with 12 salt rounds
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordResetToken = undefined;
  user.passwordResetExpiry = undefined;
  // Invalidate all existing refresh tokens (force re-login everywhere)
  user.refreshTokens = [];

  await user.save();

  return {
    message: 'Password reset successful. You can now log in with your new password.'
  };
};

/**
 * Get current authenticated user details and profile.
 */
export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  const profile = await getProfileByRole(user._id, user.role);
  return { user, profile };
};
