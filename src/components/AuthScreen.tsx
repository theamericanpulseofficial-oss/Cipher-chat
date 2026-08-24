import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Loader2,
  KeyRound,
  LogIn
} from 'lucide-react';
import { loginUser, registerUser, signInWithGoogle } from '../services/authService';
import { UserProfile } from '../types';
import { useToast } from './Toast';

interface AuthScreenProps {
  onAuthSuccess: (profile: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const { showToast } = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const profile = await signInWithGoogle();
      showToast(`Signed in as ${profile.name}!`, 'success');
      onAuthSuccess(profile);
    } catch (err: unknown) {
      console.error('Google Sign In error:', err);
      const msg = err instanceof Error ? err.message : 'Google sign in failed.';
      if (msg.includes('popup-closed-by-user')) {
        setError('Sign in popup was closed. Please try again.');
      } else {
        setError('Google authentication error: ' + msg);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your name or chat code.');
      return;
    }
    if (trimmedName.length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const profile = await loginUser(trimmedName, password);
        showToast(`Welcome back, ${profile.name}!`, 'success');
        onAuthSuccess(profile);
      } else {
        const profile = await registerUser(trimmedName, password);
        showToast(`Account created! Your Chat Code is ${profile.chatCode}`, 'success');
        onAuthSuccess(profile);
      }
    } catch (err: unknown) {
      console.error('Auth error:', err);
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please check credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#fafafa] dark:bg-[#0f1117] text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-md">
        {/* Brand Logo Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-700 text-white shadow-md mb-3">
            <ShieldCheck size={26} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            CipherChat
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Private code-based real-time messaging
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white dark:bg-[#181b24] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          {/* Google Sign-In Primary Button */}
          <button
            type="button"
            id="google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold flex items-center justify-center gap-3 transition-colors shadow-xs cursor-pointer mb-5 disabled:opacity-60"
          >
            {googleLoading ? (
              <Loader2 size={18} className="animate-spin text-indigo-600" />
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-[#181b24] px-2 text-slate-400 font-medium tracking-wider">
                Or username & passkey
              </span>
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mb-5 border border-slate-200/80 dark:border-slate-700">
            <button
              type="button"
              id="tab-btn-login"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              id="tab-btn-register"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                {mode === 'login' ? 'Name or Chat Code' : 'Username'}
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-input-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={mode === 'login' ? 'e.g. Alice or K8X-4P2' : 'e.g. Alice'}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12141c] text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-600 dark:focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-input-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12141c] text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-600 dark:focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div className="animate-in fade-in duration-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-input-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12141c] text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-600 dark:focus:border-indigo-500 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                  <Sparkles size={12} className="text-indigo-600 shrink-0" />
                  A unique 6-character Chat Code will automatically be generated for you.
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98 disabled:opacity-60 cursor-pointer mt-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Dashboard' : 'Register & Get Chat Code'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
