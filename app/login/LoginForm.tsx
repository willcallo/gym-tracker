'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

type Mode = 'signin' | 'signup';

const MIN_PASSWORD = 10;

const input =
  'h-14 w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand';

export default function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const signingUp = mode === 'signup';
  const ready = signingUp
    ? !!name.trim() && !!email && password.length >= MIN_PASSWORD && !!inviteCode.trim()
    : !!email && !!password;

  function switchMode(to: Mode) {
    setMode(to);
    setError('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error } = signingUp
        ? await authClient.signUp.email({
            name: name.trim(),
            email,
            password,
            // Read by the sign-up hook in lib/auth.ts; not stored.
            ...({ inviteCode: inviteCode.trim() } as object),
          })
        : await authClient.signIn.email({ email, password });
      if (error) {
        setError(messageFor(error.status, error.message, signingUp));
        setBusy(false);
        return;
      }
      window.location.assign(next);
    } catch {
      setError('Could not reach the server, try again');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {signingUp && (
        <input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          aria-label="Your name"
          maxLength={80}
          className={input}
        />
      )}
      <input
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        aria-label="Email"
        className={input}
      />
      <div>
        <input
          type="password"
          autoComplete={signingUp ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          aria-label="Password"
          className={input}
        />
        {signingUp && <p className="mt-1 text-sm text-gray-600">At least {MIN_PASSWORD} characters.</p>}
      </div>
      {signingUp && (
        <input
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="Invite code"
          aria-label="Invite code"
          className={input}
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !ready}
        className="h-14 w-full rounded-xl bg-brand text-xl font-bold text-white disabled:opacity-50"
      >
        {signingUp ? (busy ? 'Creating account...' : 'Create account') : busy ? 'Signing in...' : 'Sign in'}
      </button>
      <button
        type="button"
        onClick={() => switchMode(signingUp ? 'signin' : 'signup')}
        className="min-h-12 w-full text-base font-semibold text-brand-ink"
      >
        {signingUp ? 'I already have an account' : 'Create an account'}
      </button>
    </form>
  );
}

function messageFor(status: number, message: string | undefined, signingUp: boolean): string {
  if (status === 429) return 'Too many attempts. Wait a minute and try again.';
  if (!signingUp) return status === 401 ? 'Wrong email or password' : 'Could not sign in, try again';
  if (status === 403) return 'That invite code is not right';
  // Sign-up validation messages (email taken, invalid email) are written for people; show them.
  return message || 'Could not create the account, try again';
}
