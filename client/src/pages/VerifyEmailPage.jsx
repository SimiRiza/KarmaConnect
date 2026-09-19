import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as authService from '../services/authService';
import { CheckCircle2, XCircle, ArrowRight, Loader2 } from 'lucide-react';

export const VerifyEmailPage = () => {
  const { token } = useParams();
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const verifyToken = async () => {
      try {
        const data = await authService.verifyEmail(token);
        if (isMounted) {
          setStatus('success');
          setMessage(data.message || 'Your email has been verified successfully!');
        }
      } catch (err) {
        if (isMounted) {
          setStatus('error');
          setMessage(
            err.response?.data?.message ||
            'The verification link is invalid or has expired. Please request a new link.'
          );
        }
      }
    };

    if (token) {
      verifyToken();
    } else {
      setStatus('error');
      setMessage('No verification token was provided.');
    }

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 border border-stone-200 shadow-sm text-center space-y-6">
        {status === 'verifying' && (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 text-brand-600 animate-spin mx-auto" />
            <h2 className="text-xl font-bold text-stone-900">Verifying your email...</h2>
            <p className="text-stone-500 text-sm">
              Please wait while we confirm your credentials.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-extrabold text-stone-900">Email Verified!</h2>
            <p className="text-stone-600 text-sm leading-relaxed">
              {message}
            </p>
            <div className="pt-3">
              <Link
                to="/login"
                className="w-full py-3.5 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm text-center flex items-center justify-center gap-2 shadow-md shadow-brand-600/20 transition-all"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-5">
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <XCircle className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-extrabold text-stone-900">Verification Failed</h2>
            <p className="text-stone-600 text-sm leading-relaxed">
              {message}
            </p>
            <div className="pt-3 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/login"
                className="w-full py-3 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-sm transition-colors"
              >
                Go to Sign In
              </Link>
              <Link
                to="/signup"
                className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-colors shadow-sm"
              >
                Create Account
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
