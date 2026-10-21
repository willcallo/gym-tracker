'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btn, Card, inputCls, labelCls } from '../../components/ui';
import ConfirmButton from '../../components/ConfirmButton';
import Toggle from '../../components/Toggle';
import { capitalize } from '@/lib/format';
import { MUSCLE_GROUPS } from '@/lib/types';
import type { Exercise, MuscleGroup } from '@/lib/types';

export default function ExerciseEditor({
  exercise,
  hasHistory,
}: {
  exercise: Exercise;
  hasHistory: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(exercise.name);
  const [primary, setPrimary] = useState<MuscleGroup>(exercise.primary_muscle);
  const [secondary, setSecondary] = useState<MuscleGroup | ''>(exercise.secondary_muscle ?? '');
  const [bodyweight, setBodyweight] = useState(exercise.is_bodyweight);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/exercises/${exercise.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          primary_muscle: primary,
          secondary_muscle: secondary || null,
          is_bodyweight: bodyweight,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not save changes');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError('');
    try {
      const res = await fetch(`/api/exercises/${exercise.id}`, { method: 'DELETE' });
      if (res.ok || res.status === 404) {
        router.replace('/exercises');
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'Could not delete the exercise');
    } catch {
      setError('No connection. Try again.');
    }
  }

  if (!open) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setOpen(true)} className={`${btn('secondary')} w-full`}>
          Edit exercise
        </button>
        {!hasHistory && (
          <ConfirmButton
            label="Delete exercise"
            confirmLabel="Delete"
            message={`Delete ${exercise.name}? It has no logged sessions yet.`}
            onConfirm={remove}
            className="w-full"
          />
        )}
        {hasHistory && (
          <p className="text-sm text-gray-600">
            This exercise has logged sessions, so it can be edited but not deleted.
          </p>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <Card>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label htmlFor="e-name" className={labelCls}>
            Name
          </label>
          <input
            id="e-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="e-primary" className={labelCls}>
            Primary muscle
          </label>
          <select
            id="e-primary"
            value={primary}
            onChange={(e) => {
              const next = e.target.value as MuscleGroup;
              setPrimary(next);
              if (secondary === next) setSecondary('');
            }}
            className={inputCls}
          >
            {MUSCLE_GROUPS.map((m) => (
              <option key={m} value={m}>
                {capitalize(m)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="e-secondary" className={labelCls}>
            Secondary muscle (optional)
          </label>
          <select
            id="e-secondary"
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
            <p className="text-sm text-gray-600">
              {hasHistory
                ? 'Logged sets keep their stored values. PRs switch to match.'
                : 'Tracked by reps, no weight field.'}
            </p>
          </div>
          <Toggle label="Bodyweight exercise" checked={bodyweight} onChange={setBodyweight} />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setOpen(false)} className={btn('secondary')}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={btn('primary')}>
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Card>
  );
}
