import { Pool, types } from 'pg';
import type {
  Exercise,
  ExerciseInput,
  ExerciseOverview,
  ExercisePoint,
  ExerciseWithLast,
  SessionInput,
  SessionWithSets,
  SetValues,
  Settings,
  TrainingSummary,
} from './types';

// DATE stays a plain 'YYYY-MM-DD' string, NUMERIC becomes a JS number,
// TIMESTAMPTZ becomes an ISO string.
types.setTypeParser(1082, (v: string) => v);
types.setTypeParser(1700, (v: string) => parseFloat(v));
types.setTypeParser(1184, (v: string) => new Date(v).toISOString());

// Cached on globalThis so dev hot reloads don't leak pools.
const g = globalThis as unknown as { __gymPool?: Pool };
const pool =
  g.__gymPool ??
  (g.__gymPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: process.env.VERCEL ? 3 : 10,
  }));

// ── Shared SQL fragments ─────────────────────────────────────

// Sessions with their exercises and sets as one JSON column.
const SESSION_SELECT = `
  SELECT s.id, s.date, s.label, s.notes, s.coaching_note, s.coaching_at, s.coaching_stale,
    COALESCE((
      SELECT json_agg(g ORDER BY g.position)
      FROM (
        SELECT st.exercise_position AS position, st.exercise_id,
               e.name AS exercise_name, e.primary_muscle, e.secondary_muscle, e.is_bodyweight,
               json_agg(json_build_object(
                 'id', st.id, 'set_number', st.set_number,
                 'reps', st.reps, 'weight', st.weight, 'rpe', st.rpe
               ) ORDER BY st.set_number) AS sets
        FROM sets st JOIN exercises e ON e.id = st.exercise_id
        WHERE st.session_id = s.id
        GROUP BY st.exercise_position, st.exercise_id, e.name, e.primary_muscle,
                 e.secondary_muscle, e.is_bodyweight
      ) g
    ), '[]'::json) AS exercises
  FROM sessions s`;

// For each exercise: the session it was last done in, plus that session's sets.
const LAST_SETS_JOINS = `
  LEFT JOIN (
    SELECT DISTINCT ON (st.exercise_id) st.exercise_id, st.session_id, s.date AS last_date
    FROM sets st JOIN sessions s ON s.id = st.session_id
    ORDER BY st.exercise_id, s.date DESC, s.id DESC
  ) ls ON ls.exercise_id = e.id
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('reps', st.reps, 'weight', st.weight, 'rpe', st.rpe)
                    ORDER BY st.exercise_position, st.set_number) AS last_sets
    FROM sets st WHERE st.session_id = ls.session_id AND st.exercise_id = e.id
  ) l ON true`;

// ── Sessions ─────────────────────────────────────────────────

export interface SessionCursor {
  date: string;
  id: number;
}

export async function getSessionsPage(
  limit: number,
  before?: SessionCursor
): Promise<{ sessions: SessionWithSets[]; nextCursor: SessionCursor | null }> {
  const { rows } = await pool.query(
    `${SESSION_SELECT}
     WHERE $1::date IS NULL OR (s.date, s.id) < ($1::date, $2::int)
     ORDER BY s.date DESC, s.id DESC
     LIMIT $3`,
    [before?.date ?? null, before?.id ?? null, limit + 1]
  );
  const hasMore = rows.length > limit;
  const sessions = (hasMore ? rows.slice(0, limit) : rows) as SessionWithSets[];
  const last = sessions[sessions.length - 1];
  return { sessions, nextCursor: hasMore && last ? { date: last.date, id: last.id } : null };
}

export async function getSession(id: number): Promise<SessionWithSets | null> {
  const { rows } = await pool.query(`${SESSION_SELECT} WHERE s.id = $1`, [id]);
  return (rows[0] as SessionWithSets) ?? null;
}

function flattenSets(blocks: SessionInput['blocks']) {
  const exerciseIds: number[] = [];
  const positions: number[] = [];
  const setNumbers: number[] = [];
  const reps: number[] = [];
  const weights: (number | null)[] = [];
  const rpes: (number | null)[] = [];
  blocks.forEach((b, position) => {
    b.sets.forEach((s, i) => {
      exerciseIds.push(b.exercise_id);
      positions.push(position);
      setNumbers.push(i + 1);
      reps.push(s.reps);
      weights.push(s.weight);
      rpes.push(s.rpe);
    });
  });
  return [exerciseIds, positions, setNumbers, reps, weights, rpes];
}

const UNNEST_SETS = `unnest($1::int[], $2::int[], $3::int[], $4::int[], $5::numeric[], $6::numeric[])
  AS u(exercise_id, exercise_position, set_number, reps, weight, rpe)`;

// One statement: the session row and all of its sets go in together or not at all.
export async function createSession(input: SessionInput): Promise<number> {
  const arrays = flattenSets(input.blocks);
  const { rows } = await pool.query(
    `WITH s AS (
       INSERT INTO sessions (date, label, notes) VALUES ($7, $8, $9) RETURNING id
     )
     INSERT INTO sets (session_id, exercise_id, exercise_position, set_number, reps, weight, rpe)
     SELECT s.id, u.exercise_id, u.exercise_position, u.set_number, u.reps, u.weight, u.rpe
     FROM s, ${UNNEST_SETS}
     RETURNING session_id`,
    [...arrays, input.date, input.label, input.notes]
  );
  return rows[0].session_id as number;
}

// Replaces the session's sets. A stored coaching note is kept but flagged as out of date.
export async function updateSession(id: number, input: SessionInput): Promise<boolean> {
  const arrays = flattenSets(input.blocks);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE sessions
       SET date = $2, label = $3, notes = $4, updated_at = now(),
           coaching_stale = (coaching_note IS NOT NULL)
       WHERE id = $1`,
      [id, input.date, input.label, input.notes]
    );
    if (upd.rowCount === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query('DELETE FROM sets WHERE session_id = $1', [id]);
    await client.query(
      `INSERT INTO sets (session_id, exercise_id, exercise_position, set_number, reps, weight, rpe)
       SELECT $7::int, u.exercise_id, u.exercise_position, u.set_number, u.reps, u.weight, u.rpe
       FROM ${UNNEST_SETS}`,
      [...arrays, id]
    );
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteSession(id: number): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

export async function saveCoachingNote(id: number, note: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'UPDATE sessions SET coaching_note = $2, coaching_at = now(), coaching_stale = false WHERE id = $1',
    [id, note]
  );
  return (rowCount ?? 0) > 0;
}

// ── Exercises ────────────────────────────────────────────────

export async function getExercisesForLog(): Promise<ExerciseWithLast[]> {
  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.is_bodyweight, e.primary_muscle, e.secondary_muscle,
            COALESCE(l.last_sets, '[]'::json) AS last_sets
     FROM exercises e ${LAST_SETS_JOINS}
     ORDER BY e.name`
  );
  return rows as ExerciseWithLast[];
}

export async function getExerciseOverview(): Promise<{
  exercises: ExerciseOverview[];
  sessionCount: number;
  summary: TrainingSummary | null;
}> {
  const [exRes, metaRes] = await Promise.all([
    pool.query(
      `SELECT e.id, e.name, e.is_bodyweight, e.primary_muscle, e.secondary_muscle,
              COALESCE(p.session_count, 0)::int AS session_count,
              CASE WHEN e.is_bodyweight THEN p.max_reps ELSE p.max_weight END AS pr,
              ls.last_date, COALESCE(l.last_sets, '[]'::json) AS last_sets
       FROM exercises e
       LEFT JOIN (
         SELECT exercise_id, count(DISTINCT session_id) AS session_count,
                max(weight) AS max_weight, max(reps) AS max_reps
         FROM sets GROUP BY exercise_id
       ) p ON p.exercise_id = e.id
       ${LAST_SETS_JOINS}
       ORDER BY COALESCE(p.session_count, 0) DESC, ls.last_date DESC NULLS LAST, e.name`
    ),
    pool.query(
      `SELECT (SELECT count(*) FROM sessions)::int AS session_count,
              t.summary, t.session_count AS summary_session_count, t.generated_at
       FROM (SELECT 1) x LEFT JOIN training_summary t ON true`
    ),
  ]);
  const m = metaRes.rows[0];
  return {
    exercises: exRes.rows as ExerciseOverview[],
    sessionCount: m.session_count,
    summary: m.summary
      ? { summary: m.summary, session_count: m.summary_session_count, generated_at: m.generated_at }
      : null,
  };
}

export async function getExerciseDetail(
  id: number
): Promise<{ exercise: Exercise; points: ExercisePoint[] } | null> {
  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.is_bodyweight, e.primary_muscle, e.secondary_muscle,
            COALESCE(pts.points, '[]'::json) AS points
     FROM exercises e
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
                'session_id', x.session_id, 'date', x.date, 'label', x.label,
                'top_weight', x.top_weight, 'max_reps', x.max_reps,
                'volume', x.volume, 'sets', x.sets
              ) ORDER BY x.date, x.session_id) AS points
       FROM (
         SELECT s.id AS session_id, s.date, s.label,
                max(st.weight) AS top_weight, max(st.reps) AS max_reps,
                CASE WHEN e.is_bodyweight THEN sum(st.reps)
                     ELSE sum(st.reps * COALESCE(st.weight, 0)) END AS volume,
                json_agg(json_build_object('reps', st.reps, 'weight', st.weight, 'rpe', st.rpe)
                         ORDER BY st.exercise_position, st.set_number) AS sets
         FROM sets st JOIN sessions s ON s.id = st.session_id
         WHERE st.exercise_id = e.id
         GROUP BY s.id, s.date, s.label
       ) x
     ) pts ON true
     WHERE e.id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  const { points: raw, ...exercise } = row;

  let best = -Infinity;
  const points = (raw as Omit<ExercisePoint, 'isPR'>[]).map((p) => {
    const value = exercise.is_bodyweight ? p.max_reps : p.top_weight;
    const isPR = value !== null && value > best;
    if (isPR) best = value;
    return { ...p, isPR };
  });
  return { exercise: exercise as Exercise, points };
}

export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  const { rows } = await pool.query(
    `INSERT INTO exercises (name, is_bodyweight, primary_muscle, secondary_muscle)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, is_bodyweight, primary_muscle, secondary_muscle`,
    [input.name, input.is_bodyweight, input.primary_muscle, input.secondary_muscle]
  );
  return rows[0] as Exercise;
}

export async function updateExercise(id: number, input: ExerciseInput): Promise<Exercise | null> {
  const { rows } = await pool.query(
    `UPDATE exercises SET name = $2, is_bodyweight = $3, primary_muscle = $4, secondary_muscle = $5
     WHERE id = $1
     RETURNING id, name, is_bodyweight, primary_muscle, secondary_muscle`,
    [id, input.name, input.is_bodyweight, input.primary_muscle, input.secondary_muscle]
  );
  return (rows[0] as Exercise) ?? null;
}

// Exercises with logged sets can't be deleted (the FK is RESTRICT as a backstop).
export async function deleteExercise(id: number): Promise<'deleted' | 'has_sets' | 'not_found'> {
  const del = await pool.query(
    `DELETE FROM exercises e
     WHERE e.id = $1 AND NOT EXISTS (SELECT 1 FROM sets WHERE exercise_id = e.id)`,
    [id]
  );
  if ((del.rowCount ?? 0) > 0) return 'deleted';
  const { rows } = await pool.query('SELECT 1 FROM exercises WHERE id = $1', [id]);
  return rows.length ? 'has_sets' : 'not_found';
}

// ── Settings ─────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = { rest_timer_enabled: true, rest_seconds: 90 };

export async function getSettings(): Promise<Settings> {
  const { rows } = await pool.query('SELECT rest_timer_enabled, rest_seconds FROM settings');
  return (rows[0] as Settings) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const { rows } = await pool.query(
    `INSERT INTO settings (id, rest_timer_enabled, rest_seconds)
     VALUES (true, COALESCE($1, true), COALESCE($2, 90))
     ON CONFLICT (id) DO UPDATE SET
       rest_timer_enabled = COALESCE($1, settings.rest_timer_enabled),
       rest_seconds = COALESCE($2, settings.rest_seconds),
       updated_at = now()
     RETURNING rest_timer_enabled, rest_seconds`,
    [patch.rest_timer_enabled ?? null, patch.rest_seconds ?? null]
  );
  return rows[0] as Settings;
}

// ── AI context ───────────────────────────────────────────────

export interface CoachingContext {
  priorBest: { exercise_id: number; max_weight: number | null; max_reps: number }[];
  recentHistory: { date: string; label: string | null; muscle_counts: Record<string, number> }[];
}

// Only sessions before this one count, so coaching an old session isn't skewed by later work.
export async function getCoachingContext(session: {
  id: number;
  date: string;
}): Promise<CoachingContext> {
  const { rows } = await pool.query(
    `WITH prior AS (
       SELECT s.id, s.date, s.label FROM sessions s
       WHERE (s.date, s.id) < ($1::date, $2::int)
     )
     SELECT
       COALESCE((
         SELECT json_agg(json_build_object(
                  'exercise_id', b.exercise_id, 'max_weight', b.max_weight, 'max_reps', b.max_reps))
         FROM (
           SELECT st.exercise_id, max(st.weight) AS max_weight, max(st.reps) AS max_reps
           FROM sets st JOIN prior p ON p.id = st.session_id
           GROUP BY st.exercise_id
         ) b
       ), '[]'::json) AS prior_best,
       COALESCE((
         SELECT json_agg(json_build_object(
                  'date', r.date, 'label', r.label,
                  'muscle_counts', COALESCE((
                    SELECT json_object_agg(m.muscle, m.cnt)
                    FROM (
                      SELECT e.primary_muscle AS muscle, count(*)::int AS cnt
                      FROM sets st JOIN exercises e ON e.id = st.exercise_id
                      WHERE st.session_id = r.id GROUP BY e.primary_muscle
                    ) m
                  ), '{}'::json)
                ) ORDER BY r.date DESC, r.id DESC)
         FROM (SELECT * FROM prior ORDER BY date DESC, id DESC LIMIT 5) r
       ), '[]'::json) AS recent`,
    [session.date, session.id]
  );
  return {
    priorBest: rows[0].prior_best,
    recentHistory: rows[0].recent,
  };
}

export interface SummaryContext {
  sessionCount: number;
  recentSessions: number;
  muscles: { muscle: string; sets: number }[];
  prs: { name: string; is_bodyweight: boolean; best: number }[];
}

export async function getSummaryContext(): Promise<SummaryContext> {
  const { rows } = await pool.query(
    `WITH recent AS (SELECT id FROM sessions ORDER BY date DESC, id DESC LIMIT 10)
     SELECT
       (SELECT count(*) FROM sessions)::int AS session_count,
       (SELECT count(*) FROM recent)::int AS recent_sessions,
       COALESCE((
         SELECT json_agg(json_build_object('muscle', m.muscle, 'sets', m.sets) ORDER BY m.sets DESC)
         FROM (
           SELECT e.primary_muscle AS muscle, count(*)::int AS sets
           FROM sets st JOIN recent r ON r.id = st.session_id
           JOIN exercises e ON e.id = st.exercise_id GROUP BY e.primary_muscle
         ) m
       ), '[]'::json) AS muscles,
       COALESCE((
         SELECT json_agg(json_build_object('name', p.name, 'is_bodyweight', p.is_bodyweight, 'best', p.best)
                         ORDER BY p.n DESC, p.name)
         FROM (
           SELECT e.name, e.is_bodyweight, count(DISTINCT st.session_id) AS n,
                  CASE WHEN e.is_bodyweight THEN max(st.reps) ELSE max(st.weight) END AS best
           FROM sets st JOIN exercises e ON e.id = st.exercise_id
           GROUP BY e.id ORDER BY n DESC, e.name LIMIT 10
         ) p
       ), '[]'::json) AS prs`
  );
  const r = rows[0];
  return {
    sessionCount: r.session_count,
    recentSessions: r.recent_sessions,
    muscles: r.muscles,
    prs: r.prs,
  };
}

export async function saveTrainingSummary(summary: string, sessionCount: number): Promise<void> {
  await pool.query(
    `INSERT INTO training_summary (id, summary, session_count) VALUES (true, $1, $2)
     ON CONFLICT (id) DO UPDATE SET
       summary = EXCLUDED.summary, session_count = EXCLUDED.session_count, generated_at = now()`,
    [summary, sessionCount]
  );
}

export type { SetValues };
