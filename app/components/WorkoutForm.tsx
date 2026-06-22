'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Exercise, MuscleGroup } from '@/lib/types';
import { MUSCLE_GROUPS } from '@/lib/types';

interface SetInput {
  id: string;
  reps: string;
  weight: string;
  rpe: string;
}

interface ExerciseBlock {
  id: string;
  exercise: Exercise | null;
  isBodyweight: boolean;
  sets: SetInput[];
  query: string;
  showPicker: boolean;
  creating: boolean;
  newName: string;
  newPrimary: MuscleGroup | '';
  newSecondary: MuscleGroup | '';
  newBW: boolean;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function emptySet(defaults?: { reps?: string; weight?: string }): SetInput {
  return { id: uid(), reps: defaults?.reps ?? '', weight: defaults?.weight ?? '', rpe: '' };
}

function emptyBlock(): ExerciseBlock {
  return {
    id: uid(),
    exercise: null,
    isBodyweight: false,
    sets: [emptySet()],
    query: '',
    showPicker: false,
    creating: false,
    newName: '',
    newPrimary: '',
    newSecondary: '',
    newBW: false,
  };
}

interface Props {
  exercises: Exercise[];
  lastSets?: Record<number, { reps: number; weight: number | null }>;
}

const inputCls =
  'w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-3 text-base text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500';

export default function WorkoutForm({ exercises: initialExercises, lastSets = {} }: Props) {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([emptyBlock()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitLabel, setSubmitLabel] = useState('Finish Workout');
  const [error, setError] = useState<string | null>(null);
  const pickerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function updateBlock(id: string, patch: Partial<ExerciseBlock>) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function updateSet(blockId: string, setId: string, patch: Partial<SetInput>) {
    setBlocks((bs) =>
      bs.map((b) =>
        b.id === blockId
          ? { ...b, sets: b.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }
          : b
      )
    );
  }

  function addSet(blockId: string) {
    setBlocks((bs) =>
      bs.map((b) => {
        if (b.id !== blockId) return b;
        const last = b.sets[b.sets.length - 1];
        return {
          ...b,
          sets: [
            ...b.sets,
            { ...emptySet(), reps: last?.reps ?? '', weight: last?.weight ?? '' },
          ],
        };
      })
    );
  }

  function removeSet(blockId: string, setId: string) {
    setBlocks((bs) =>
      bs.map((b) =>
        b.id === blockId && b.sets.length > 1
          ? { ...b, sets: b.sets.filter((s) => s.id !== setId) }
          : b
      )
    );
  }

  function removeBlock(id: string) {
    setBlocks((bs) => (bs.length > 1 ? bs.filter((b) => b.id !== id) : bs));
  }

  function selectExercise(blockId: string, ex: Exercise) {
    const last = lastSets[ex.id];
    const isBW = ex.is_bodyweight === 1;
    const defaultSet = emptySet({
      reps: last ? String(last.reps) : '',
      weight: last?.weight != null && !isBW ? String(last.weight) : '',
    });
    updateBlock(blockId, {
      exercise: ex,
      isBodyweight: isBW,
      query: ex.name,
      showPicker: false,
      creating: false,
      sets: [defaultSet],
    });
  }

  async function createAndSelect(blockId: string) {
    const block = blocks.find((b) => b.id === blockId)!;
    if (!block.newPrimary) return;
    try {
      const res = await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: block.newName,
          is_bodyweight: block.newBW ? 1 : 0,
          primary_muscle: block.newPrimary,
          secondary_muscle: block.newSecondary || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const ex: Exercise = await res.json();
      setExercises((prev) => [...prev, ex].sort((a, b) => a.name.localeCompare(b.name)));
      selectExercise(blockId, ex);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create exercise');
    }
  }

  async function handleSubmit() {
    setError(null);

    for (const block of blocks) {
      if (!block.exercise) {
        setError('Select an exercise for each block');
        return;
      }
      for (const s of block.sets) {
        if (!s.reps || parseInt(s.reps) < 1) {
          setError('All sets need a rep count');
          return;
        }
        if (!block.isBodyweight && (!s.weight || parseFloat(s.weight) <= 0)) {
          setError(`Enter a weight for ${block.exercise.name}`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const sets = blocks.flatMap((b) =>
        b.sets.map((s, i) => ({
          exercise_id: b.exercise!.id,
          set_number: i + 1,
          reps: parseInt(s.reps),
          weight: b.isBodyweight ? null : parseFloat(s.weight),
          is_bodyweight: b.isBodyweight ? 1 : 0,
          rpe: s.rpe ? parseFloat(s.rpe) : null,
        }))
      );

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, label: label || null, notes: notes || null, sets }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { sessionId } = await res.json();

      setSubmitLabel('Getting AI coaching…');
      try {
        await fetch(`/api/coaching/${sessionId}`, { method: 'POST' });
      } catch {
        // Non-fatal
      }

      router.push(`/history#session-${sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save workout');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Session meta */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Label</label>
            <input
              type="text"
              placeholder="e.g. Morning"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Notes</label>
          <textarea
            rows={2}
            placeholder="How you felt, goals…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      {/* Exercise blocks */}
      {blocks.map((block, blockIdx) => {
        const filtered =
          block.query.length > 0
            ? exercises.filter((e) => e.name.toLowerCase().includes(block.query.toLowerCase()))
            : exercises;
        const exactMatch = exercises.find(
          (e) => e.name.toLowerCase() === block.query.toLowerCase()
        );

        return (
          <div key={block.id} className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
            {/* Exercise picker */}
            <div className="px-4 py-4 border-b border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-600 w-4 shrink-0">{blockIdx + 1}</span>
                <div
                  className="relative flex-1"
                  ref={(el) => { pickerRefs.current[block.id] = el; }}
                >
                  <input
                    type="text"
                    placeholder="Search exercise…"
                    value={block.query}
                    onFocus={() => updateBlock(block.id, { showPicker: true })}
                    onChange={(e) =>
                      updateBlock(block.id, {
                        query: e.target.value,
                        showPicker: true,
                        exercise: null,
                      })
                    }
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-3 text-base text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {block.showPicker && (
                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-700 bg-gray-900 shadow-2xl max-h-64 overflow-y-auto">
                      {filtered.slice(0, 20).map((ex) => (
                        <button
                          key={ex.id}
                          onMouseDown={() => selectExercise(block.id, ex)}
                          className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-gray-800 active:bg-gray-700 border-b border-gray-800 last:border-0"
                        >
                          <span className="text-sm text-gray-100">{ex.name}</span>
                          <span className="text-xs text-gray-500">{ex.primary_muscle}</span>
                        </button>
                      ))}
                      {block.query.length > 1 && !exactMatch && (
                        <button
                          onMouseDown={() =>
                            updateBlock(block.id, {
                              showPicker: false,
                              creating: true,
                              newName: block.query,
                              newPrimary: '',
                              newSecondary: '',
                              newBW: false,
                            })
                          }
                          className="flex w-full items-center gap-2 px-4 py-3.5 text-left text-sm text-indigo-400 hover:bg-gray-800 border-t border-gray-800"
                        >
                          + Create &ldquo;{block.query}&rdquo;
                        </button>
                      )}
                      {filtered.length === 0 && !block.query && (
                        <p className="px-4 py-3 text-sm text-gray-500">Start typing…</p>
                      )}
                    </div>
                  )}
                </div>

                {blocks.length > 1 && (
                  <button
                    onClick={() => removeBlock(block.id)}
                    className="text-gray-600 hover:text-red-400 shrink-0 px-1 text-lg leading-none"
                    aria-label="Remove exercise"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Muscle badges + bodyweight toggle */}
              {block.exercise && (
                <div className="flex items-center gap-2 ml-6 flex-wrap">
                  <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-indigo-400">
                    {block.exercise.primary_muscle}
                  </span>
                  {block.exercise.secondary_muscle && (
                    <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-gray-500">
                      {block.exercise.secondary_muscle}
                    </span>
                  )}
                  <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
                    <input
                      type="checkbox"
                      checked={block.isBodyweight}
                      onChange={(e) => updateBlock(block.id, { isBodyweight: e.target.checked })}
                      className="accent-indigo-500 w-4 h-4"
                    />
                    <span className="text-xs text-gray-400">Bodyweight</span>
                  </label>
                </div>
              )}

              {/* Inline create form */}
              {block.creating && (
                <div className="mt-3 ml-6 space-y-3 rounded-xl border border-gray-700 bg-gray-800 p-4">
                  <p className="text-sm font-medium text-gray-300">New: {block.newName}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Primary *</label>
                      <select
                        value={block.newPrimary}
                        onChange={(e) =>
                          updateBlock(block.id, { newPrimary: e.target.value as MuscleGroup })
                        }
                        className="w-full rounded-lg border border-gray-600 bg-gray-700 px-2 py-2.5 text-sm text-gray-100 focus:outline-none"
                      >
                        <option value="">Select…</option>
                        {MUSCLE_GROUPS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Secondary</label>
                      <select
                        value={block.newSecondary}
                        onChange={(e) =>
                          updateBlock(block.id, { newSecondary: e.target.value as MuscleGroup })
                        }
                        className="w-full rounded-lg border border-gray-600 bg-gray-700 px-2 py-2.5 text-sm text-gray-100 focus:outline-none"
                      >
                        <option value="">None</option>
                        {MUSCLE_GROUPS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={block.newBW}
                      onChange={(e) => updateBlock(block.id, { newBW: e.target.checked })}
                      className="accent-indigo-500 w-4 h-4"
                    />
                    <span className="text-sm text-gray-400">Bodyweight exercise</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => createAndSelect(block.id)}
                      disabled={!block.newPrimary}
                      className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => updateBlock(block.id, { creating: false, query: '' })}
                      className="rounded-xl bg-gray-700 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sets */}
            {block.exercise && !block.creating && (
              <div className="px-4 py-3">
                {/* Column headers */}
                <div
                  className={`grid gap-2 mb-2 text-xs text-gray-500 ${
                    block.isBodyweight
                      ? 'grid-cols-[28px_1fr_1fr_32px]'
                      : 'grid-cols-[28px_1fr_1fr_1fr_32px]'
                  }`}
                >
                  <span>#</span>
                  <span>Reps</span>
                  {!block.isBodyweight && <span>kg</span>}
                  <span>RPE</span>
                  <span />
                </div>

                {block.sets.map((s, si) => (
                  <div
                    key={s.id}
                    className={`grid gap-2 mb-2 items-center ${
                      block.isBodyweight
                        ? 'grid-cols-[28px_1fr_1fr_32px]'
                        : 'grid-cols-[28px_1fr_1fr_1fr_32px]'
                    }`}
                  >
                    <span className="text-xs text-gray-600 text-center">{si + 1}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      placeholder="10"
                      value={s.reps}
                      onChange={(e) => updateSet(block.id, s.id, { reps: e.target.value })}
                      className={inputCls}
                    />
                    {!block.isBodyweight && (
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.5}
                        placeholder="60"
                        value={s.weight}
                        onChange={(e) => updateSet(block.id, s.id, { weight: e.target.value })}
                        className={inputCls}
                      />
                    )}
                    <input
                      type="number"
                      inputMode="decimal"
                      min={1}
                      max={10}
                      step={0.5}
                      placeholder="8"
                      value={s.rpe}
                      onChange={(e) => updateSet(block.id, s.id, { rpe: e.target.value })}
                      className={inputCls}
                    />
                    <button
                      onClick={() => removeSet(block.id, s.id)}
                      disabled={block.sets.length === 1}
                      className="flex items-center justify-center h-10 w-8 text-gray-600 hover:text-red-400 disabled:opacity-20 text-lg"
                      aria-label="Remove set"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => addSet(block.id)}
                  className="mt-1 w-full rounded-xl border border-dashed border-gray-700 py-2.5 text-sm text-indigo-400 hover:border-indigo-600 hover:text-indigo-300 transition-colors"
                >
                  + Add set
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add exercise */}
      <button
        onClick={() => setBlocks((bs) => [...bs, emptyBlock()])}
        className="w-full rounded-xl border border-dashed border-gray-700 py-4 text-sm text-gray-500 hover:border-gray-600 hover:text-gray-400 transition-colors"
      >
        + Add exercise
      </button>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-xl bg-indigo-600 py-4 text-base font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? submitLabel : 'Finish Workout'}
      </button>
    </div>
  );
}
