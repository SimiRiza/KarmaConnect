import nodemailer from 'nodemailer';
import { validateEmailConfig } from '../config/environment.js';

/**
 * Configure Nodemailer transporter using environment variables.
 */
const createTransporter = () => {
  validateEmailConfig();
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }

  // Fallback / unconfigured transport
  return null;
};

/**
 * Send an email or log it to the console if unconfigured in development.
 */
const sendMailSafe = async ({ to, subject, text, html, actionUrl, actionLabel }) => {
  const from = process.env.EMAIL_FROM || 'KarmaConnect <noreply@karmaconnect.org>';
  const transporter = createTransporter();

  if (process.env.NODE_ENV !== 'production') {
    console.log('\n======================================================');
    console.log('📧 [MOCK EMAIL SERVICE — DEVELOPMENT]');
    console.log(`To:      ${to}`);
    console.log(`From:    ${from}`);
    console.log(`Subject: ${subject}`);
    console.log(`Action:  ${actionLabel} -> ${actionUrl}`);
    console.log('------------------------------------------------------');
    console.log(text);
    console.log('======================================================\n');
  }

  if (transporter) {
    try {
      await transporter.sendMail({ from, to, subject, text, html });
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        // SMTP errors may contain credentials or message content; do not expose them.
        throw Object.assign(new Error('Email delivery failed. Please try again later or contact support.'), { statusCode: 503 });
      }
      console.warn(`⚠️ Failed to send email via SMTP to ${to}: ${err.message}`);
      // Preserve the existing development console fallback.
    }
  }
};

/**
 * Send account verification email.
 */
export const sendVerificationEmail = async (email, token, name) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const verificationUrl = `${clientUrl}/verify-email/${token}`;

  const subject = 'Verify your email for KarmaConnect';
  const text = `Hi ${name},\n\nWelcome to KarmaConnect! Please verify your email by clicking the link below:\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nFrom local problems to real impact — together.\nTeam KarmaConnect`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #fcfbf9;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0d9488; margin: 0;">KarmaConnect</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">From local problems to real impact — together.</p>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <h2 style="color: #1e293b; margin-top: 0;">Verify your email address</h2>
        <p style="color: #475569; line-height: 1.6;">Hi ${name},</p>
        <p style="color: #475569; line-height: 1.6;">Thank you for joining KarmaConnect. To activate your account and start connecting with local impact initiatives, please verify your email address below:</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verificationUrl}" style="background-color: #f97316; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify My Account</a>
        </div>
        <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">Or copy and paste this link into your browser:<br/><a href="${verificationUrl}" style="color: #0d9488;">${verificationUrl}</a></p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">This verification link will expire in 24 hours. If you did not sign up for KarmaConnect, please disregard this email.</p>
      </div>
    </div>
  `;

  await sendMailSafe({
    to: email,
    subject,
    text,
    html,
    actionUrl: verificationUrl,
    actionLabel: 'Verify Account'
  });
};

/**
 * Send password reset email.
 */
export const sendPasswordResetEmail = async (email, token, name) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const resetUrl = `${clientUrl}/reset-password/${token}`;

  const subject = 'Reset your KarmaConnect password';
  const text = `Hi ${name},\n\nYou requested a password reset for your KarmaConnect account. Use the link below to set a new password:\n${resetUrl}\n\nThis link will expire in 1 hour. If you did not request this, you can safely ignore this email.\n\nTeam KarmaConnect`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #fcfbf9;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0d9488; margin: 0;">KarmaConnect</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">From local problems to real impact — together.</p>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <h2 style="color: #1e293b; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #475569; line-height: 1.6;">Hi ${name},</p>
        <p style="color: #475569; line-height: 1.6;">We received a request to reset your password. Click the button below to choose a new password:</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="background-color: #f97316; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">Or copy and paste this link into your browser:<br/><a href="${resetUrl}" style="color: #0d9488;">${resetUrl}</a></p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">This link will expire in 1 hour. If you did not request a password reset, please ignore this email or reach out to security support.</p>
      </div>
    </div>
  `;

  await sendMailSafe({
    to: email,
    subject,
    text,
    html,
    actionUrl: resetUrl,
    actionLabel: 'Reset Password'
  });
};
