-- Idempotent: safe to run on every container start or repeatedly by hand.
-- Nothing in here drops or alters data. Use `npm run db:reset` to start over.

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  is_bodyweight BOOLEAN NOT NULL DEFAULT false,
  primary_muscle TEXT NOT NULL CHECK (primary_muscle IN (
    'chest','shoulders','triceps','biceps','lats','upper back','lower back',
    'quads','hamstrings','glutes','calves','core','cardio'
  )),
  secondary_muscle TEXT CHECK (secondary_muscle IN (
    'chest','shoulders','triceps','biceps','lats','upper back','lower back',
    'quads','hamstrings','glutes','calves','core','cardio'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (secondary_muscle IS NULL OR secondary_muscle <> primary_muscle)
);
CREATE UNIQUE INDEX IF NOT EXISTS exercises_name_lower_idx ON exercises (lower(name));

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date DATE NOT NULL,
  label TEXT CHECK (label IS NULL OR length(label) <= 60),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 2000),
  coaching_note TEXT,
  coaching_at TIMESTAMPTZ,
  coaching_stale BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_date_idx ON sessions (date DESC, id DESC);

CREATE TABLE IF NOT EXISTS sets (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  exercise_position SMALLINT NOT NULL CHECK (exercise_position >= 0),
  set_number SMALLINT NOT NULL CHECK (set_number >= 1),
  reps INTEGER NOT NULL CHECK (reps BETWEEN 1 AND 1000),
  weight NUMERIC(6,2) CHECK (weight IS NULL OR weight >= 0),
  rpe NUMERIC(3,1) CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  UNIQUE (session_id, exercise_position, set_number)
);
CREATE INDEX IF NOT EXISTS sets_exercise_idx ON sets (exercise_id, session_id);

CREATE TABLE IF NOT EXISTS settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  rest_timer_enabled BOOLEAN NOT NULL DEFAULT true,
  rest_seconds INTEGER NOT NULL DEFAULT 90 CHECK (rest_seconds BETWEEN 15 AND 600),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS training_summary (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  summary TEXT NOT NULL,
  session_count INTEGER NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Added after the first release. Idempotent, so it is safe on existing databases too.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER
  CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 43200);
