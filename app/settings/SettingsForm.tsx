'use client';

import { useState } from 'react';
import { btn, Card, SectionTitle } from '../components/ui';
import Toggle from '../components/Toggle';
import { formatClock } from '@/lib/format';
import type { Settings } from '@/lib/types';
import { authClient } from '@/lib/auth-client';

const PRESETS = [60, 90, 120, 180];

export default function SettingsForm({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState('');

  async function save(patch: Partial<Settings>) {
    const previous = settings;
    setSettings({ ...settings, ...patch });
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      setSettings(await res.json());
    } catch {
      setSettings(previous);
      setError('Could not save that change. Try again.');
    }
  }

  function setRest(seconds: number) {
    save({ rest_seconds: Math.min(600, Math.max(15, seconds)) });
  }

  async function signOut() {
    await authClient.signOut().catch(() => {});
    window.location.assign('/login');
  }

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>Rest timer</SectionTitle>
        <Card className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-base font-semibold">Rest timer</p>
              <p className="text-sm text-gray-600">Starts when you enter the reps for a set.</p>
            </div>
            <Toggle
              label="Rest timer"
              checked={settings.rest_timer_enabled}
              onChange={(v) => save({ rest_timer_enabled: v })}
            />
          </div>

          <div>
            <p className="mb-2 text-base font-semibold">Rest length</p>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                aria-label="15 seconds shorter"
                className={`${btn('secondary')} w-16`}
                onClick={() => setRest(settings.rest_seconds - 15)}
              >
                -15
              </button>
              <p className="text-3xl font-bold tabular-nums" aria-live="polite">
                {formatClock(settings.rest_seconds)}
              </p>
              <button
                type="button"
                aria-label="15 seconds longer"
                className={`${btn('secondary')} w-16`}
                onClick={() => setRest(settings.rest_seconds + 15)}
              >
                +15
              </button>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setRest(p)}
                  aria-pressed={settings.rest_seconds === p}
                  className={`min-h-12 rounded-xl border text-base font-semibold ${
                    settings.rest_seconds === p
                      ? 'border-brand bg-brand-soft text-brand-ink'
                      : 'border-gray-300 text-gray-800 active:bg-gray-100'
                  }`}
                >
                  {formatClock(p)}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </Card>
      </section>

      <section>
        <SectionTitle>Account</SectionTitle>
        <button type="button" onClick={signOut} className={`${btn('secondary')} w-full`}>
          Sign out
        </button>
      </section>
    </div>
  );
}
