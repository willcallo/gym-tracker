import Database from 'better-sqlite3';
import path from 'path';
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

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'gym.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_bodyweight INTEGER NOT NULL DEFAULT 0,
      primary_muscle TEXT NOT NULL,
      secondary_muscle TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      label TEXT,
      notes TEXT,
      coaching_note TEXT,
      coaching_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);

    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      set_number INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      weight REAL,
      is_bodyweight INTEGER NOT NULL DEFAULT 0,
      rpe REAL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sets_session ON sets(session_id);
    CREATE INDEX IF NOT EXISTS idx_sets_exercise ON sets(exercise_id);

    CREATE TABLE IF NOT EXISTS dashboard_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary TEXT NOT NULL,
      session_count INTEGER NOT NULL,
      generated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY,
      bodyweight REAL,
      age INTEGER,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );
  `);

  const { count } = db.prepare('SELECT COUNT(*) as count FROM exercises').get() as { count: number };
  if (count === 0) seedExercises(db);
}

function seedExercises(db: Database.Database): void {
  const insert = db.prepare(
    'INSERT INTO exercises (name, is_bodyweight, primary_muscle, secondary_muscle) VALUES (?, ?, ?, ?)'
  );
  const seed = db.transaction(() => {
    const exercises: [string, number, string, string | null][] = [
      ['Bench Press', 0, 'chest', 'triceps'],
      ['Incline Bench Press', 0, 'chest', 'shoulders'],
      ['Decline Bench Press', 0, 'chest', 'triceps'],
      ['Dumbbell Fly', 0, 'chest', null],
      ['Cable Fly', 0, 'chest', null],
      ['Push-Up', 1, 'chest', 'triceps'],
      ['Overhead Press', 0, 'shoulders', 'triceps'],
      ['Dumbbell Lateral Raise', 0, 'shoulders', null],
      ['Front Raise', 0, 'shoulders', null],
      ['Face Pull', 0, 'upper back', 'shoulders'],
      ['Dip', 1, 'triceps', 'chest'],
      ['Tricep Pushdown', 0, 'triceps', null],
      ['Close Grip Bench Press', 0, 'triceps', 'chest'],
      ['Skull Crusher', 0, 'triceps', null],
      ['Barbell Curl', 0, 'biceps', null],
      ['Dumbbell Curl', 0, 'biceps', null],
      ['Hammer Curl', 0, 'biceps', null],
      ['Preacher Curl', 0, 'biceps', null],
      ['Chin-Up', 1, 'biceps', 'lats'],
      ['Pull-Up', 1, 'lats', 'biceps'],
      ['Lat Pulldown', 0, 'lats', 'biceps'],
      ['Straight Arm Pulldown', 0, 'lats', null],
      ['Seated Cable Row', 0, 'upper back', 'biceps'],
      ['Barbell Row', 0, 'upper back', 'biceps'],
      ['Dumbbell Row', 0, 'upper back', 'biceps'],
      ['Shrug', 0, 'upper back', null],
      ['Good Morning', 0, 'lower back', 'hamstrings'],
      ['Back Extension', 1, 'lower back', 'glutes'],
      ['Squat', 0, 'quads', 'glutes'],
      ['Front Squat', 0, 'quads', null],
      ['Leg Press', 0, 'quads', 'glutes'],
      ['Leg Extension', 0, 'quads', null],
      ['Bulgarian Split Squat', 0, 'quads', 'glutes'],
      ['Hack Squat', 0, 'quads', 'glutes'],
      ['Deadlift', 0, 'hamstrings', 'lower back'],
      ['Romanian Deadlift', 0, 'hamstrings', 'glutes'],
      ['Leg Curl', 0, 'hamstrings', null],
      ['Nordic Curl', 1, 'hamstrings', null],
      ['Hip Thrust', 0, 'glutes', 'hamstrings'],
      ['Glute Bridge', 1, 'glutes', null],
      ['Cable Kickback', 0, 'glutes', null],
      ['Standing Calf Raise', 0, 'calves', null],
      ['Seated Calf Raise', 0, 'calves', null],
      ['Plank', 1, 'core', null],
      ['Ab Wheel', 1, 'core', null],
      ['Hanging Leg Raise', 1, 'core', null],
      ['Cable Crunch', 0, 'core', null],
      ['Russian Twist', 1, 'core', null],
      ['Running', 1, 'cardio', null],
      ['Cycling', 1, 'cardio', null],
      ['Rowing Machine', 1, 'cardio', 'upper back'],
      ['Jump Rope', 1, 'cardio', 'calves'],
    ];
    for (const [name, bw, pm, sm] of exercises) insert.run(name, bw, pm, sm);
  });
  seed();
}

// ── Exercises ────────────────────────────────────────────────

export function getAllExercises(): Exercise[] {
  return getDb().prepare('SELECT * FROM exercises ORDER BY name ASC').all() as Exercise[];
}

export function createExercise(
  name: string,
  is_bodyweight: number,
  primary_muscle: MuscleGroup,
  secondary_muscle: MuscleGroup | null
): Exercise {
  return getDb()
    .prepare(
      'INSERT INTO exercises (name, is_bodyweight, primary_muscle, secondary_muscle) VALUES (?, ?, ?, ?) RETURNING *'
    )
    .get(name, is_bodyweight, primary_muscle, secondary_muscle) as Exercise;
}

// ── Sessions ─────────────────────────────────────────────────

export function getAllSessions(): Session[] {
  return getDb()
    .prepare('SELECT * FROM sessions ORDER BY date DESC, created_at DESC')
    .all() as Session[];
}

export function getRecentSessions(limit: number): Session[] {
  return getDb()
    .prepare('SELECT * FROM sessions ORDER BY date DESC, created_at DESC LIMIT ?')
    .all(limit) as Session[];
}

export function getSessionById(id: number): SessionWithSets | null {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
  if (!session) return null;

  const rawSets = db
    .prepare(
      `SELECT s.id, s.session_id, s.exercise_id, s.set_number, s.reps, s.weight,
              s.is_bodyweight, s.rpe, s.created_at,
              e.name as exercise_name, e.primary_muscle, e.secondary_muscle,
              e.is_bodyweight as is_bodyweight_exercise
       FROM sets s
       JOIN exercises e ON s.exercise_id = e.id
       WHERE s.session_id = ?
       ORDER BY s.exercise_id, s.set_number`
    )
    .all(id) as ExerciseSetRow[];

  const exerciseMap = new Map<number, ExerciseGroup>();
  for (const row of rawSets) {
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

export function createSession(date: string, label?: string, notes?: string): Session {
  return getDb()
    .prepare('INSERT INTO sessions (date, label, notes) VALUES (?, ?, ?) RETURNING *')
    .get(date, label ?? null, notes ?? null) as Session;
}

export function updateSessionCoaching(id: number, coaching_note: string): void {
  getDb()
    .prepare(
      "UPDATE sessions SET coaching_note = ?, coaching_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?"
    )
    .run(coaching_note, id);
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

export function addSets(session_id: number, sets: SetInput[]): void {
  const db = getDb();
  const insert = db.prepare(
    'INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_bodyweight, rpe) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  db.transaction(() => {
    for (const s of sets) insert.run(session_id, s.exercise_id, s.set_number, s.reps, s.weight, s.is_bodyweight, s.rpe);
  })();
}

// ── Progress ─────────────────────────────────────────────────

export function getProgressForExercise(exercise_id: number): ProgressPoint[] {
  const rows = getDb()
    .prepare(
      `SELECT sess.date, sess.id as session_id,
              MAX(s.weight) as max_weight,
              SUM(CASE WHEN s.is_bodyweight = 1 THEN s.reps ELSE s.reps * COALESCE(s.weight, 0) END) as volume
       FROM sets s
       JOIN sessions sess ON s.session_id = sess.id
       WHERE s.exercise_id = ?
       GROUP BY sess.id
       ORDER BY sess.date ASC`
    )
    .all(exercise_id) as { date: string; session_id: number; max_weight: number | null; volume: number }[];

  let runningMax: number | null = null;
  return rows.map((row) => {
    const isPR = row.max_weight !== null && (runningMax === null || row.max_weight > runningMax);
    if (isPR && row.max_weight !== null) runningMax = row.max_weight;
    return { ...row, isPR };
  });
}

export function getAllPRs(): PRRecord[] {
  return getDb()
    .prepare(
      `SELECT e.id as exercise_id, e.name as exercise_name, e.primary_muscle,
              MAX(s.weight) as max_weight, sess.date as session_date
       FROM sets s
       JOIN exercises e ON s.exercise_id = e.id
       JOIN sessions sess ON s.session_id = sess.id
       WHERE s.weight IS NOT NULL
       GROUP BY e.id
       ORDER BY e.primary_muscle, e.name`
    )
    .all() as PRRecord[];
}

export function getExercisePR(exercise_id: number): number | null {
  const row = getDb()
    .prepare('SELECT MAX(weight) as max_weight FROM sets WHERE exercise_id = ? AND weight IS NOT NULL')
    .get(exercise_id) as { max_weight: number | null };
  return row.max_weight;
}

// ── Dashboard Cache ───────────────────────────────────────────

export function getDashboardCache(): { summary: string; session_count: number } | null {
  return (
    (getDb()
      .prepare('SELECT summary, session_count FROM dashboard_cache ORDER BY id DESC LIMIT 1')
      .get() as { summary: string; session_count: number } | undefined) ?? null
  );
}

export function setDashboardCache(summary: string, session_count: number): void {
  const db = getDb();
  db.prepare('DELETE FROM dashboard_cache').run();
  db.prepare('INSERT INTO dashboard_cache (summary, session_count) VALUES (?, ?)').run(summary, session_count);
}

export function getSessionCount(): number {
  return (getDb().prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number }).count;
}

// ── Coaching Context ──────────────────────────────────────────

export interface CoachingSessionData {
  session: SessionWithSets;
  recentHistory: { date: string; label: string | null; muscleCounts: Record<string, number> }[];
  newPRs: string[];
}

export function buildCoachingData(sessionId: number): CoachingSessionData | null {
  const db = getDb();
  const session = getSessionById(sessionId);
  if (!session) return null;

  const newPRs: string[] = [];
  for (const exGroup of session.exercises) {
    if (exGroup.is_bodyweight) continue;
    const prev = db
      .prepare('SELECT MAX(s.weight) as max_weight FROM sets s WHERE s.exercise_id = ? AND s.session_id != ?')
      .get(exGroup.exercise_id, sessionId) as { max_weight: number | null };

    const weights = exGroup.sets.map((s) => s.weight ?? 0).filter((w) => w > 0);
    if (!weights.length) continue;
    const sessionMax = Math.max(...weights);
    if (prev.max_weight === null || sessionMax > prev.max_weight) {
      newPRs.push(`${exGroup.exercise_name} (${sessionMax}kg)`);
    }
  }

  const recentSessions = db
    .prepare('SELECT id, date, label FROM sessions WHERE id != ? ORDER BY date DESC, created_at DESC LIMIT 5')
    .all(sessionId) as { id: number; date: string; label: string | null }[];

  const recentHistory = recentSessions.map((s) => {
    const rows = db
      .prepare(
        `SELECT e.primary_muscle, COUNT(*) as cnt
         FROM sets st JOIN exercises e ON st.exercise_id = e.id
         WHERE st.session_id = ? GROUP BY e.primary_muscle`
      )
      .all(s.id) as { primary_muscle: string; cnt: number }[];
    const muscleCounts: Record<string, number> = {};
    for (const r of rows) muscleCounts[r.primary_muscle] = r.cnt;
    return { date: s.date, label: s.label, muscleCounts };
  });

  return { session, recentHistory, newPRs };
}

// ── User Settings ─────────────────────────────────────────────

export function getUserSettings(): { bodyweight: number | null; age: number | null } {
  const row = getDb()
    .prepare('SELECT bodyweight, age FROM user_settings LIMIT 1')
    .get() as { bodyweight: number | null; age: number | null } | undefined;
  return row ?? { bodyweight: null, age: null };
}

export function setUserSettings(bodyweight: number | null, age: number | null): void {
  const db = getDb();
  db.prepare('DELETE FROM user_settings').run();
  db.prepare('INSERT INTO user_settings (bodyweight, age) VALUES (?, ?)').run(bodyweight, age);
}

// ── Body Stats ────────────────────────────────────────────────

export function getExerciseMaxes(
  names: string[]
): Map<string, { maxWeight: number | null; maxReps: number }> {
  if (names.length === 0) return new Map();
  const db = getDb();
  const placeholders = names.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT e.name, MAX(s.weight) as max_weight, MAX(s.reps) as max_reps
       FROM sets s JOIN exercises e ON s.exercise_id = e.id
       WHERE e.name IN (${placeholders})
       GROUP BY e.name`
    )
    .all(...names) as { name: string; max_weight: number | null; max_reps: number }[];
  const map = new Map<string, { maxWeight: number | null; maxReps: number }>();
  for (const row of rows) {
    map.set(row.name, { maxWeight: row.max_weight, maxReps: row.max_reps });
  }
  return map;
}

// ── Last Sets (for pre-filling WorkoutForm) ───────────────────

export function getLastSets(): Record<number, { reps: number; weight: number | null }> {
  const rows = getDb()
    .prepare(
      `SELECT exercise_id, reps, weight
       FROM sets
       WHERE rowid IN (SELECT MAX(rowid) FROM sets GROUP BY exercise_id)`
    )
    .all() as { exercise_id: number; reps: number; weight: number | null }[];
  const result: Record<number, { reps: number; weight: number | null }> = {};
  for (const row of rows) result[row.exercise_id] = { reps: row.reps, weight: row.weight };
  return result;
}

// ── Dashboard Data ────────────────────────────────────────────

export interface DashboardData {
  recentSessions: SessionWithSets[];
  prs: PRRecord[];
  cachedSummary: string | null;
  sessionCount: number;
}

export function getDashboardData(): DashboardData {
  const db = getDb();
  const sessionCount = getSessionCount();
  const prs = getAllPRs();
  const cache = getDashboardCache();

  const ids = db
    .prepare('SELECT id FROM sessions ORDER BY date DESC, created_at DESC LIMIT 5')
    .all() as { id: number }[];

  const recentSessions = ids.map((r) => getSessionById(r.id)).filter(Boolean) as SessionWithSets[];

  return {
    recentSessions,
    prs,
    cachedSummary: cache?.session_count === sessionCount ? cache.summary : null,
    sessionCount,
  };
}
