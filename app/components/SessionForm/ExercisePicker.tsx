'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { btn, inputCls, labelCls } from '../ui';
import Toggle from '../Toggle';
import { capitalize } from '@/lib/format';
import { MUSCLE_GROUPS } from '@/lib/types';
import type { ExerciseWithLast, MuscleGroup } from '@/lib/types';

// Full-screen sheet: search the list, or create a new exercise without leaving the session.
export default function ExercisePicker({
  exercises,
  onPick,
  onCreated,
  onClose,
}: {
  exercises: ExerciseWithLast[];
  onPick: (e: ExerciseWithLast) => void;
  onCreated: (e: ExerciseWithLast) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState<MuscleGroup | ''>('');
  const [secondary, setSecondary] = useState<MuscleGroup | ''>('');
  const [bodyweight, setBodyweight] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Behaves like a real dialog: the page behind can't scroll or be reached by screen readers,
  // Escape backs out, and focus goes back to the button that opened it.
  // Read before autoFocus moves focus into the search box.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const behind = document.querySelectorAll('main, nav[aria-label="Main"]');
    behind.forEach((el) => el.setAttribute('inert', ''));
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      behind.forEach((el) => el.removeAttribute('inert'));
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [opener]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (creating) setCreating(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [creating, onClose]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      q
        ? exercises.filter((e) => e.name.toLowerCase().includes(q) || e.primary_muscle.includes(q))
        : exercises,
    [exercises, q]
  );
  const exact = exercises.some((e) => e.name.toLowerCase() === q);

  async function create(ev: React.FormEvent) {
    ev.preventDefault();
    if (!name.trim()) return setError('Give the exercise a name');
    if (!primary) return setError('Pick a primary muscle');
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          is_bodyweight: bodyweight,
          primary_muscle: primary,
          secondary_muscle: secondary || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not create the exercise');
      onCreated(data as ExerciseWithLast);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the exercise');
      setBusy(false);
    }
  }

  // In a portal so that hiding <main> from the page behind doesn't hide the dialog too.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add exercise"
      className="fixed inset-0 z-50 flex flex-col bg-white"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center gap-2 border-b border-gray-200 p-3">
        <button type="button" onClick={creating ? () => setCreating(false) : onClose} className={`${btn('ghost')} px-3`}>
          {creating ? 'Back' : 'Close'}
        </button>
        <h2 className="text-lg font-bold">{creating ? 'New exercise' : 'Add exercise'}</h2>
      </div>

      {creating ? (
        <form onSubmit={create} className="flex-1 space-y-4 overflow-y-auto p-4">
          <div>
            <label htmlFor="ex-name" className={labelCls}>
              Name
            </label>
            <input
              id="ex-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="ex-primary" className={labelCls}>
              Primary muscle
            </label>
            <select
              id="ex-primary"
              value={primary}
              onChange={(e) => setPrimary(e.target.value as MuscleGroup | '')}
              className={inputCls}
            >
              <option value="">Select...</option>
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {capitalize(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ex-secondary" className={labelCls}>
              Secondary muscle (optional)
            </label>
            <select
              id="ex-secondary"
              value={secondary}
              onChange={(e) => setSecondary(e.target.value as MuscleGroup | '')}
              className={inputCls}
            >
              <option value="">None</option>
              {MUSCLE_GROUPS.filter((m) => m !== primary).map((m) => (
                <option key={m} value={m}>
                  {capitalize(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-3">
            <div>
              <p className="text-base font-semibold">Bodyweight exercise</p>
              <p className="text-sm text-gray-600">Tracked by reps, no weight field.</p>
            </div>
            <Toggle label="Bodyweight exercise" checked={bodyweight} onChange={setBodyweight} />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className={`${btn('primary')} w-full`}>
            {busy ? 'Creating...' : 'Create and add'}
          </button>
        </form>
      ) : (
        <>
          <div className="p-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exercises"
              aria-label="Search exercises"
              autoFocus
              className={`${inputCls} h-14 text-lg`}
            />
          </div>
          <ul className="flex-1 overflow-y-auto px-3 pb-6">
            {query.trim() && !exact && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setName(query.trim());
                    setCreating(true);
                  }}
                  className="flex min-h-14 w-full items-center rounded-xl px-3 text-left text-base font-semibold text-brand-ink active:bg-brand-soft"
                >
                  Create &quot;{query.trim()}&quot;
                </button>
              </li>
            )}
            {matches.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onPick(e)}
                  className="flex min-h-14 w-full flex-col justify-center rounded-xl px-3 py-2 text-left active:bg-gray-100"
                >
                  <span className="text-base font-semibold">{e.name}</span>
                  <span className="text-sm text-gray-600">
                    {capitalize(e.primary_muscle)}
                    {e.secondary_muscle ? `, ${e.secondary_muscle}` : ''}
                    {e.is_bodyweight ? ' · bodyweight' : ''}
                  </span>
                </button>
              </li>
            ))}
            {matches.length === 0 && !query.trim() && (
              <li className="px-3 py-6 text-center text-gray-600">No exercises yet. Create your first one.</li>
            )}
            {!query.trim() && (
              <li>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="mt-2 flex min-h-14 w-full items-center rounded-xl px-3 text-left text-base font-semibold text-brand-ink active:bg-brand-soft"
                >
                  Create a new exercise
                </button>
              </li>
            )}
          </ul>
        </>
      )}
    </div>,
    document.body
  );
}
