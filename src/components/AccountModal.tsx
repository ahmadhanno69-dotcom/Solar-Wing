import React, { useState } from 'react';
import type { AuthUser } from '../services/progressService';
import { PilotIcon } from './GameIcons';

interface AccountModalProps {
  currentUser: AuthUser | null;
  lastUsername: string | null;
  onLogin: (username: string, passcode: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onRegister: (username: string, passcode: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onLogout: () => void;
  onSkipLocal: () => void;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  currentUser,
  lastUsername,
  onLogin,
  onRegister,
  onLogout,
  onSkipLocal,
  onClose,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(lastUsername ? 'login' : 'register');
  const [username, setUsername] = useState(lastUsername || '');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fn = mode === 'login' ? onLogin : onRegister;
    const res = await fn(username.trim(), passcode);
    setSubmitting(false);
    if (!res.ok) {
      setError('error' in res ? res.error : 'Authentication failed');
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#070b14]/82 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pilot Account Sign In"
        className="w-full max-w-md rounded-lg bg-[#111a2c] border border-slate-700/80 p-7 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <PilotIcon className="w-5 h-5 text-amber-400" />
            <h2 className="font-display text-3xl font-extrabold tracking-wide uppercase text-white">
              Pilot Account
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
          >
            Close
          </button>
        </div>

        {currentUser ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-md bg-slate-900/90 border border-slate-800 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Cross-Browser Sync
              </div>
              <div className="mt-1 text-lg font-bold text-amber-400">{currentUser.username}</div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Your achievements, wave clears, and best scores are saved both in this browser and under your pilot callsign.
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm cursor-pointer"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm cursor-pointer"
              >
                Sign Out (Keep Local Save)
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Sign in with a callsign and passcode to carry your progress across browsers, or play locally without an account.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-1 p-1 rounded-md bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`py-2 text-xs font-semibold rounded transition-colors cursor-pointer ${
                  mode === 'login' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`py-2 text-xs font-semibold rounded transition-colors cursor-pointer ${
                  mode === 'register' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Create Pilot
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="pilot-username" className="block text-xs font-semibold text-slate-300 mb-1">
                  Username
                </label>
                <input
                  id="pilot-username"
                  type="text"
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={24}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Letters, numbers, _ or -"
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label htmlFor="pilot-passcode" className="block text-xs font-semibold text-slate-300 mb-1">
                  Passcode
                </label>
                <input
                  id="pilot-passcode"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={4}
                  maxLength={32}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="4–32 characters"
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {error && (
                <div role="alert" className="text-xs font-medium text-rose-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-semibold text-sm transition-colors cursor-pointer"
              >
                {submitting
                  ? 'Connecting...'
                  : mode === 'login'
                    ? 'Sign In & Sync Progress'
                    : 'Create Pilot & Save Progress'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                onSkipLocal();
                onClose();
              }}
              className="mt-3 w-full py-2 px-4 rounded-md bg-transparent hover:bg-slate-800/70 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
            >
              No thanks, continue saving locally
            </button>
          </>
        )}
      </div>
    </div>
  );
};
