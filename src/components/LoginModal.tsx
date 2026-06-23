'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, User, Lock, Loader2, Code2, Sparkles } from 'lucide-react';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
}

interface LoginModalProps {
  onAuthenticated: (user: UserProfile) => void;
}

export default function LoginModal({ onAuthenticated }: LoginModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          displayName: displayName.trim() || undefined,
          isRegister: mode === 'register',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }

      // The HttpOnly cookie is now set by the server.
      // Notify parent with the returned user profile.
      onAuthenticated(data.user);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setError('');
    setUsername('');
    setPassword('');
    setDisplayName('');
  };

  return (
    // Full-screen backdrop — completely blocks interaction
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="relative w-full max-w-md mx-4">
        {/* Glow accent */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-primary/30 via-tertiary/20 to-secondary/30 blur-xl opacity-60 pointer-events-none" />

        <div className="relative bg-surface-container-highest border border-outline-variant/50 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary/10 via-transparent to-tertiary/10 px-8 pt-8 pb-6 text-center border-b border-outline-variant/30">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl overflow-hidden border border-outline-variant/30 flex items-center justify-center shadow-lg shadow-primary/10 bg-[#070c1b]">
              <img src="/collabcode-logo.jpg" alt="Logo" className="w-full h-full object-contain p-1.5" />
            </div>
            <h1 className="font-ui-header text-xl font-bold text-on-surface tracking-tight">CollabCode IDE</h1>
            <p className="text-xs text-outline mt-1">
              {mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace account'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-6 flex flex-col gap-4">
            {/* Display Name — register only */}
            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-outline">
                  Display Name
                </label>
                <div className="relative">
                  <Sparkles size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline/60 pointer-events-none" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name (optional)"
                    maxLength={40}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-xl pl-9 pr-4 py-2.5 text-sm text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-outline">
                Username
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline/60 pointer-events-none" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  required
                  autoFocus
                  autoComplete="username"
                  maxLength={20}
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-xl pl-9 pr-4 py-2.5 text-sm text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all font-code-block"
                />
              </div>
              {mode === 'register' && (
                <p className="text-[10px] text-outline/70 ml-1">3–20 chars: letters, numbers, underscores</p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-outline">
                Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline/60 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-xl pl-9 pr-10 py-2.5 text-sm text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline/60 hover:text-on-surface transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {mode === 'register' && (
                <p className="text-[10px] text-outline/70 ml-1">At least 6 characters</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="px-3 py-2.5 bg-error/10 border border-error/25 rounded-xl text-error text-xs font-medium">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-1 py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : mode === 'login' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Switch mode footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-outline">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={switchMode}
                className="text-primary font-semibold hover:underline underline-offset-2 transition-colors"
              >
                {mode === 'login' ? 'Register' : 'Sign In'}
              </button>
            </p>
            <p className="text-[10px] text-outline/50 mt-3 leading-relaxed">
              Sessions are secured with HttpOnly cookies.
              <br />Your password is never stored in plain text.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
