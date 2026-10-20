'use client';

import { useState } from 'react';

export default function LoginForm({ next }: { next?: string }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError(res.status === 401 ? 'Wrong password' : 'Could not sign in, try again');
        setBusy(false);
        return;
      }
      const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
      window.location.assign(target);
    } catch {
      setError('Could not sign in, try again');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input
        type="password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="h-14 w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy || !password}
        className="h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
