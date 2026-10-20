import { MUSCLE_GROUPS } from './types';
import type { ExerciseInput, MuscleGroup, SessionInput, SetValues } from './types';

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function optText(v: unknown, max: number): string | null | undefined {
  if (v == null) return null;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (t.length > max) return undefined;
  return t === '' ? null : t;
}

function isMuscle(v: unknown): v is MuscleGroup {
  return typeof v === 'string' && (MUSCLE_GROUPS as readonly string[]).includes(v);
}

export function parseExerciseInput(body: unknown): Result<ExerciseInput> {
  if (!isRecord(body)) return { ok: false, error: 'Invalid request' };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 80) return { ok: false, error: 'Name is required (80 characters max)' };
  if (!isMuscle(body.primary_muscle)) return { ok: false, error: 'Pick a primary muscle' };
  const secondary = body.secondary_muscle == null || body.secondary_muscle === '' ? null : body.secondary_muscle;
  if (secondary !== null && !isMuscle(secondary)) return { ok: false, error: 'Invalid secondary muscle' };
  if (secondary === body.primary_muscle) {
    return { ok: false, error: 'Secondary muscle must differ from the primary' };
  }
  return {
    ok: true,
    value: {
      name,
      is_bodyweight: body.is_bodyweight === true,
      primary_muscle: body.primary_muscle,
      secondary_muscle: secondary,
    },
  };
}

function parseSet(raw: unknown): SetValues | null {
  if (!isRecord(raw)) return null;
  const { reps, weight, rpe } = raw;
  if (typeof reps !== 'number' || !Number.isInteger(reps) || reps < 1 || reps > 1000) return null;
  if (weight != null && (typeof weight !== 'number' || !(weight >= 0) || weight > 9999)) return null;
  if (rpe != null && (typeof rpe !== 'number' || !(rpe >= 1) || rpe > 10)) return null;
  return { reps, weight: weight ?? null, rpe: rpe ?? null };
}

export function parseSessionInput(body: unknown): Result<SessionInput> {
  if (!isRecord(body)) return { ok: false, error: 'Invalid request' };

  const date = body.date;
  if (typeof date !== 'string' || !DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
    return { ok: false, error: 'A valid date is required' };
  }
  const label = optText(body.label, 60);
  if (label === undefined) return { ok: false, error: 'Label is too long (60 characters max)' };
  const notes = optText(body.notes, 2000);
  if (notes === undefined) return { ok: false, error: 'Notes are too long (2000 characters max)' };

  if (!Array.isArray(body.blocks) || body.blocks.length === 0 || body.blocks.length > 60) {
    return { ok: false, error: 'Add at least one exercise' };
  }
  const blocks: SessionInput['blocks'] = [];
  for (const b of body.blocks) {
    if (!isRecord(b) || !Number.isInteger(b.exercise_id) || !Array.isArray(b.sets)) {
      return { ok: false, error: 'Invalid exercise block' };
    }
    if (b.sets.length === 0 || b.sets.length > 100) return { ok: false, error: 'Each exercise needs at least one set' };
    const sets: SetValues[] = [];
    for (const s of b.sets) {
      const parsed = parseSet(s);
      if (!parsed) return { ok: false, error: 'Invalid set values' };
      sets.push(parsed);
    }
    blocks.push({ exercise_id: b.exercise_id as number, sets });
  }
  return { ok: true, value: { date, label, notes, blocks } };
}

export function parseSettingsInput(
  body: unknown
): Result<{ rest_timer_enabled?: boolean; rest_seconds?: number }> {
  if (!isRecord(body)) return { ok: false, error: 'Invalid request' };
  const out: { rest_timer_enabled?: boolean; rest_seconds?: number } = {};
  if (body.rest_timer_enabled !== undefined) {
    if (typeof body.rest_timer_enabled !== 'boolean') return { ok: false, error: 'Invalid timer setting' };
    out.rest_timer_enabled = body.rest_timer_enabled;
  }
  if (body.rest_seconds !== undefined) {
    const n = body.rest_seconds;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 15 || n > 600) {
      return { ok: false, error: 'Rest length must be between 15 and 600 seconds' };
    }
    out.rest_seconds = n;
  }
  return { ok: true, value: out };
}
