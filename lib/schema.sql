-- Runs automatically on every Vercel build (previews and production) and on container start,
-- so it must stay additive and idempotent: CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS.
-- Never drop, rename, update or delete here (scripts/db-init.mjs refuses to run if it sees DROP,
-- TRUNCATE or DELETE FROM). The previous release's code keeps running against the new schema
-- while a deploy is in flight, so new columns must be nullable or have defaults.
-- Use `npm run db:reset` to start over locally.

-- Accounts and login sessions, in the shape Better Auth expects (its column names are camelCase,
-- so they need quoting). Regenerate with `npx auth@latest generate` after changing lib/auth.ts
-- in a way that touches its tables, and copy any new columns in here by hand.
CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL,
  "image" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");

-- One row per way of signing in. For email + password the hash lives in "password".
CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

-- Counters for login rate limiting.
CREATE TABLE IF NOT EXISTS "rateLimit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "count" INTEGER NOT NULL,
  "lastRequest" BIGINT NOT NULL
);

-- App data. Every row belongs to one account: user_id on each table, removed with the account.
-- lib/db.ts filters every query by user_id; the keys below are the backstop.

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
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
  CHECK (secondary_muscle IS NULL OR secondary_muscle <> primary_muscle),
  -- Target of the composite foreign key on sets.
  UNIQUE (id, user_id)
);
-- Names are unique per person, not across the whole app.
CREATE UNIQUE INDEX IF NOT EXISTS exercises_user_name_lower_idx ON exercises (user_id, lower(name));

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  date DATE NOT NULL,
  label TEXT CHECK (label IS NULL OR length(label) <= 60),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 2000),
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 43200),
  -- Lets the app retry a save after a dropped connection without creating a duplicate session.
  client_key TEXT,
  coaching_note TEXT,
  coaching_at TIMESTAMPTZ,
  coaching_stale BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
CREATE INDEX IF NOT EXISTS sessions_user_date_idx ON sessions (user_id, date DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_user_client_key_idx ON sessions (user_id, client_key);

-- user_id is repeated here so both foreign keys can include it: a set can only join a session and
-- an exercise that belong to the same person. The exercise key has no ON DELETE action, so an
-- exercise with logged sets can't be removed on its own. It is deferred to the end of the
-- transaction because deleting an account removes exercises and sessions (and through them, sets)
-- in no fixed order; checked any earlier, that fails whenever the exercises go first.
CREATE TABLE IF NOT EXISTS sets (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  exercise_position SMALLINT NOT NULL CHECK (exercise_position >= 0),
  set_number SMALLINT NOT NULL CHECK (set_number >= 1),
  reps INTEGER NOT NULL CHECK (reps BETWEEN 1 AND 1000),
  weight NUMERIC(6,2) CHECK (weight IS NULL OR weight >= 0),
  rpe NUMERIC(3,1) CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  -- 'dropset' is one word because the additive-schema check bans the word on its own.
  set_type TEXT NOT NULL DEFAULT 'normal' CHECK (set_type IN ('normal','warmup','dropset','failure')),
  UNIQUE (session_id, exercise_position, set_number),
  FOREIGN KEY (session_id, user_id) REFERENCES sessions (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id, user_id) REFERENCES exercises (id, user_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS sets_exercise_idx ON sets (exercise_id, session_id);

-- One row per person, created the first time they change a setting.
CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  rest_timer_enabled BOOLEAN NOT NULL DEFAULT true,
  rest_seconds INTEGER NOT NULL DEFAULT 90 CHECK (rest_seconds BETWEEN 15 AND 600),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_summary (
  user_id TEXT PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  summary TEXT NOT NULL,
  session_count INTEGER NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI requests per person per day, for the daily cap.
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  day DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
