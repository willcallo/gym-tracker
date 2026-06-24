import { Pool, types } from 'pg';
import type {
  Exercise,
  Session,
  ExerciseSetRow,
  ExerciseGroup,
  SessionWithSets,
  ProgressPoint,
  PRRecord,
  MuscleGroup,
} from './types';

// Return TIMESTAMP/TIMESTAMPTZ columns as ISO strings rather than Date objects
types.setTypeParser(1114, (str: string) => new Date(str).toISOString());
types.setTypeParser(1184, (str: string) => new Date(str).toISOString());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

// Lazy init: runs once per process (cold start), reused on warm requests
let initPromise: Promise<void> | null = null;
function ensureInit(): Promise<void> {
  if (!initPromise) initPromise = initSchema();
  return initPromise;
}

async function initSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exercises (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      is_bodyweight INTEGER NOT NULL DEFAULT 0,
      primary_muscle TEXT NOT NULL,
      secondary_muscle TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      label TEXT,
      notes TEXT,
      coaching_note TEXT,
      coaching_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);

    CREATE TABLE IF NOT EXISTS sets (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      weight DOUBLE PRECISION,
      is_bodyweight INTEGER NOT NULL DEFAULT 0,
      rpe DOUBLE PRECISION,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_sets_session ON sets(session_id);
    CREATE INDEX IF NOT EXISTS idx_sets_exercise ON sets(exercise_id);

    CREATE TABLE IF NOT EXISTS dashboard_cache (
      id SERIAL PRIMARY KEY,
      summary TEXT NOT NULL,
      session_count INTEGER NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      bodyweight DOUBLE PRECISION,
      age INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

// ── Exercises ────────────────────────────────────────────────

export async function getAllExercises(): Promise<Exercise[]> {
  await ensureInit();
  const { rows } = await pool.query('SELECT * FROM exercises ORDER BY name ASC');
  return rows as Exercise[];
}

export async function deleteExercise(id: number): Promise<boolean> {
  await ensureInit();
  const { rowCount } = await pool.query('DELETE FROM exercises WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

export async function createExercise(
  name: string,
  is_bodyweight: number,
  primary_muscle: MuscleGroup,
  secondary_muscle: MuscleGroup | null
): Promise<Exercise> {
  await ensureInit();
  const { rows } = await pool.query(
    'INSERT INTO exercises (name, is_bodyweight, primary_muscle, secondary_muscle) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, is_bodyweight, primary_muscle, secondary_muscle]
  );
  return rows[0] as Exercise;
}

// ── Sessions ─────────────────────────────────────────────────

export async function getAllSessions(): Promise<Session[]> {
  await ensureInit();
  const { rows } = await pool.query(
    'SELECT * FROM sessions ORDER BY date DESC, created_at DESC'
  );
  return rows as Session[];
}

export async function getRecentSessions(limit: number): Promise<Session[]> {
  await ensureInit();
  const { rows } = await pool.query(
    'SELECT * FROM sessions ORDER BY date DESC, created_at DESC LIMIT $1',
    [limit]
  );
  return rows as Session[];
}

export async function getSessionById(id: number): Promise<SessionWithSets | null> {
  await ensureInit();
  const { rows: sessionRows } = await pool.query(
    'SELECT * FROM sessions WHERE id = $1',
    [id]
  );
  if (!sessionRows[0]) return null;
  const session = sessionRows[0] as Session;

  const { rows: rawSets } = await pool.query(
    `SELECT s.id, s.session_id, s.exercise_id, s.set_number, s.reps, s.weight,
            s.is_bodyweight, s.rpe, s.created_at,
            e.name AS exercise_name, e.primary_muscle, e.secondary_muscle,
            e.is_bodyweight AS is_bodyweight_exercise
     FROM sets s
     JOIN exercises e ON s.exercise_id = e.id
     WHERE s.session_id = $1
     ORDER BY s.exercise_id, s.set_number`,
    [id]
  );
  const rows = rawSets as ExerciseSetRow[];

  const exerciseMap = new Map<number, ExerciseGroup>();
  for (const row of rows) {
    if (!exerciseMap.has(row.exercise_id)) {
      exerciseMap.set(row.exercise_id, {
        exercise_id: row.exercise_id,
        exercise_name: row.exercise_name,
        primary_muscle: row.primary_muscle,
        secondary_muscle: row.secondary_muscle,
        is_bodyweight: row.is_bodyweight_exercise,
        sets: [],
      });
    }
    exerciseMap.get(row.exercise_id)!.sets.push({
      id: row.id,
      set_number: row.set_number,
      reps: row.reps,
      weight: row.weight,
      is_bodyweight: row.is_bodyweight,
      rpe: row.rpe,
    });
  }

  return { ...session, exercises: Array.from(exerciseMap.values()) };
}

export async function createSession(date: string, label?: string, notes?: string): Promise<Session> {
  await ensureInit();
  const { rows } = await pool.query(
    'INSERT INTO sessions (date, label, notes) VALUES ($1, $2, $3) RETURNING *',
    [date, label ?? null, notes ?? null]
  );
  return rows[0] as Session;
}

export async function updateSessionCoaching(id: number, coaching_note: string): Promise<void> {
  await pool.query(
    'UPDATE sessions SET coaching_note = $1, coaching_at = NOW() WHERE id = $2',
    [coaching_note, id]
  );
}

// ── Sets ─────────────────────────────────────────────────────

export interface SetInput {
  exercise_id: number;
  set_number: number;
  reps: number;
  weight: number | null;
  is_bodyweight: number;
  rpe: number | null;
}

export async function addSets(session_id: number, sets: SetInput[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const s of sets) {
      await client.query(
        'INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_bodyweight, rpe) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [session_id, s.exercise_id, s.set_number, s.reps, s.weight, s.is_bodyweight, s.rpe]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ── Progress ─────────────────────────────────────────────────

export async function getProgressForExercise(exercise_id: number): Promise<ProgressPoint[]> {
  await ensureInit();
  const { rows } = await pool.query(
    `SELECT sess.date, sess.id AS session_id,
            MAX(s.weight) AS max_weight,
            SUM(CASE WHEN s.is_bodyweight = 1 THEN s.reps ELSE s.reps * COALESCE(s.weight, 0) END) AS volume
     FROM sets s
     JOIN sessions sess ON s.session_id = sess.id
     WHERE s.exercise_id = $1
     GROUP BY sess.id
     ORDER BY sess.date ASC`,
    [exercise_id]
  );

  let runningMax: number | null = null;
  return rows.map((row) => {
    const maxWeight = row.max_weight !== null ? Number(row.max_weight) : null;
    const volume = Number(row.volume);
    const isPR = maxWeight !== null && (runningMax === null || maxWeight > runningMax);
    if (isPR && maxWeight !== null) runningMax = maxWeight;
    return { date: row.date as string, session_id: Number(row.session_id), max_weight: maxWeight, volume, isPR };
  });
}

export async function getAllPRs(): Promise<PRRecord[]> {
  await ensureInit();
  const { rows } = await pool.query(
    `WITH ranked AS (
       SELECT
         s.exercise_id,
         s.weight AS max_weight,
         sess.date AS session_date,
         ROW_NUMBER() OVER (PARTITION BY s.exercise_id ORDER BY s.weight DESC, sess.date DESC) AS rn
       FROM sets s
       JOIN sessions sess ON s.session_id = sess.id
       WHERE s.weight IS NOT NULL
     )
     SELECT e.id AS exercise_id, e.name AS exercise_name, e.primary_muscle,
            r.max_weight, r.session_date
     FROM ranked r
     JOIN exercises e ON e.id = r.exercise_id
     WHERE r.rn = 1
     ORDER BY e.primary_muscle, e.name`
  );
  return rows.map((r) => ({ ...r, max_weight: Number(r.max_weight) })) as PRRecord[];
}

export async function getExercisePR(exercise_id: number): Promise<number | null> {
  await ensureInit();
  const { rows } = await pool.query(
    'SELECT MAX(weight) AS max_weight FROM sets WHERE exercise_id = $1 AND weight IS NOT NULL',
    [exercise_id]
  );
  const val = rows[0]?.max_weight;
  return val != null ? Number(val) : null;
}

// ── Dashboard Cache ───────────────────────────────────────────

export async function getDashboardCache(): Promise<{ summary: string; session_count: number } | null> {
  await ensureInit();
  const { rows } = await pool.query(
    'SELECT summary, session_count FROM dashboard_cache ORDER BY id DESC LIMIT 1'
  );
  return rows[0] ?? null;
}

export async function setDashboardCache(summary: string, session_count: number): Promise<void> {
  await pool.query('DELETE FROM dashboard_cache');
  await pool.query(
    'INSERT INTO dashboard_cache (summary, session_count) VALUES ($1, $2)',
    [summary, session_count]
  );
}

export async function getSessionCount(): Promise<number> {
  await ensureInit();
  const { rows } = await pool.query('SELECT COUNT(*) AS count FROM sessions');
  return Number(rows[0].count);
}

// ── Coaching Context ──────────────────────────────────────────

export interface CoachingSessionData {
  session: SessionWithSets;
  recentHistory: { date: string; label: string | null; muscleCounts: Record<string, number> }[];
  newPRs: string[];
}

export async function buildCoachingData(sessionId: number): Promise<CoachingSessionData | null> {
  await ensureInit();
  const session = await getSessionById(sessionId);
  if (!session) return null;

  const newPRs: string[] = [];
  for (const exGroup of session.exercises) {
    if (exGroup.is_bodyweight) continue;
    const { rows } = await pool.query(
      'SELECT MAX(s.weight) AS max_weight FROM sets s WHERE s.exercise_id = $1 AND s.session_id != $2',
      [exGroup.exercise_id, sessionId]
    );
    const prevMax = rows[0]?.max_weight != null ? Number(rows[0].max_weight) : null;
    const weights = exGroup.sets.map((s) => s.weight ?? 0).filter((w) => w > 0);
    if (!weights.length) continue;
    const sessionMax = Math.max(...weights);
    if (prevMax === null || sessionMax > prevMax) {
      newPRs.push(`${exGroup.exercise_name} (${sessionMax}kg)`);
    }
  }

  const { rows: recentRows } = await pool.query(
    'SELECT id, date, label FROM sessions WHERE id != $1 ORDER BY date DESC, created_at DESC LIMIT 5',
    [sessionId]
  );

  const recentHistory = await Promise.all(
    recentRows.map(async (s: { id: number; date: string; label: string | null }) => {
      const { rows: muscleRows } = await pool.query(
        `SELECT e.primary_muscle, COUNT(*) AS cnt
         FROM sets st JOIN exercises e ON st.exercise_id = e.id
         WHERE st.session_id = $1 GROUP BY e.primary_muscle`,
        [s.id]
      );
      const muscleCounts: Record<string, number> = {};
      for (const r of muscleRows) muscleCounts[r.primary_muscle] = Number(r.cnt);
      return { date: s.date, label: s.label, muscleCounts };
    })
  );

  return { session, recentHistory, newPRs };
}

// ── User Settings ─────────────────────────────────────────────

export async function getUserSettings(): Promise<{ bodyweight: number | null; age: number | null }> {
  await ensureInit();
  const { rows } = await pool.query('SELECT bodyweight, age FROM user_settings LIMIT 1');
  return rows[0] ?? { bodyweight: null, age: null };
}

export async function setUserSettings(bodyweight: number | null, age: number | null): Promise<void> {
  await ensureInit();
  await pool.query(
    `INSERT INTO user_settings (id, bodyweight, age) VALUES (1, $1, $2)
     ON CONFLICT (id) DO UPDATE SET bodyweight = $1, age = $2, updated_at = NOW()`,
    [bodyweight, age]
  );
}

// ── Body Stats ────────────────────────────────────────────────

// Returns max weight (weighted exercises) and max reps (bodyweight exercises)
// keyed by primary_muscle, so tiers work with any user-created exercise names.
export async function getMaxesByMuscleGroup(): Promise<Map<string, { maxWeight: number | null; maxReps: number }>> {
  await ensureInit();
  const { rows } = await pool.query(
    `SELECT
       e.primary_muscle,
       MAX(CASE WHEN e.is_bodyweight = 0 AND s.weight IS NOT NULL THEN s.weight ELSE NULL END) AS max_weight,
       MAX(CASE WHEN e.is_bodyweight = 1 THEN s.reps ELSE NULL END) AS max_reps
     FROM sets s
     JOIN exercises e ON s.exercise_id = e.id
     GROUP BY e.primary_muscle`
  );
  const map = new Map<string, { maxWeight: number | null; maxReps: number }>();
  for (const row of rows) {
    map.set(row.primary_muscle as string, {
      maxWeight: row.max_weight != null ? Number(row.max_weight) : null,
      maxReps: row.max_reps != null ? Number(row.max_reps) : 0,
    });
  }
  return map;
}

// ── Last Sets ─────────────────────────────────────────────────

export async function getLastSets(): Promise<Record<number, { reps: number; weight: number | null }>> {
  await ensureInit();
  const { rows } = await pool.query(
    `SELECT exercise_id, reps, weight
     FROM sets
     WHERE id IN (SELECT MAX(id) FROM sets GROUP BY exercise_id)`
  );
  const result: Record<number, { reps: number; weight: number | null }> = {};
  for (const row of rows) {
    result[Number(row.exercise_id)] = {
      reps: Number(row.reps),
      weight: row.weight != null ? Number(row.weight) : null,
    };
  }
  return result;
}

// ── Dashboard Data ────────────────────────────────────────────

export interface DashboardData {
  recentSessions: SessionWithSets[];
  prs: PRRecord[];
  cachedSummary: string | null;
  sessionCount: number;
}

export async function getDashboardData(): Promise<DashboardData> {
  await ensureInit();

  const [sessionCount, prs, cache] = await Promise.all([
    getSessionCount(),
    getAllPRs(),
    getDashboardCache(),
  ]);

  const { rows: ids } = await pool.query(
    'SELECT id FROM sessions ORDER BY date DESC, created_at DESC LIMIT 5'
  );

  const recentSessions = (
    await Promise.all(ids.map((r: { id: number }) => getSessionById(r.id)))
  ).filter(Boolean) as SessionWithSets[];

  return {
    recentSessions,
    prs,
    cachedSummary: cache?.session_count === sessionCount ? cache.summary : null,
    sessionCount,
  };
}
