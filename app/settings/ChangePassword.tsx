'use client';

import { useState } from 'react';
import { btn } from '../components/ui';
import { authClient } from '@/lib/auth-client';

const MIN_PASSWORD = 10;

const input =
  'h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand';

export default function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      // Other devices are signed out; this one keeps working.
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (error) {
        setError(
          error.status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : error.code === 'INVALID_PASSWORD'
              ? 'The current password is not right'
              : error.message || 'Could not change the password, try again'
        );
        return;
      }
      setCurrent('');
      setNext('');
      setOpen(false);
      setDone(true);
    } catch {
      setError('Could not reach the server, try again');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="space-y-2">
        {done && (
          <p role="status" className="text-sm text-green-800">
            Password changed. Your other devices have been signed out.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
          className={`${btn('secondary')} w-full`}
        >
          Change password
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        placeholder="Current password"
        aria-label="Current password"
        className={input}
      />
      <div>
        <input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="New password"
          aria-label="New password"
          className={input}
        />
        <p className="mt-1 text-sm text-gray-600">At least {MIN_PASSWORD} characters.</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError('');
          }}
          className={btn('secondary')}
        >
          Cancel
        </button>
        <button type="submit" disabled={busy || !current || next.length < MIN_PASSWORD} className={btn('primary')}>
          {busy ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}
