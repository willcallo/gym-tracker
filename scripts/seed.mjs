import fs from 'node:fs';
import { connect } from './_db.mjs';

// Sample data for one account: ~10 weeks of push / pull / legs with slow progression.
//   npm run db:seed -- you@example.com
// The account must already exist (sign up in the app first). Refuses to run if that account
// already has sessions, so it can't duplicate or clobber real data.

const email = (process.argv[2] ?? process.env.SEED_EMAIL ?? '').trim().toLowerCase();
if (!email) {
  console.error('Which account? Run `npm run db:seed -- you@example.com` (sign up in the app first).');
  process.exit(1);
}

// The same list every new account starts with.
const STARTER = JSON.parse(fs.readFileSync(new URL('../lib/starter-exercises.json', import.meta.url), 'utf8'));

// Starting weight and weekly step for each lift, used only to invent plausible history.
const PROGRESSION = {
  'Bench Press': [70, 1.25],
  'Overhead Press': [40, 1],
  'Incline Dumbbell Press': [24, 0.5],
  'Lateral Raise': [10, 0.25],
  'Triceps Pushdown': [30, 1],
  'Dips': [0, 0],
  'Barbell Row': [60, 1.25],
  'Lat Pulldown': [55, 1.25],
  'Pull-ups': [0, 0],
  'Face Pull': [20, 0.5],
  'Dumbbell Curl': [12, 0.25],
  'Back Squat': [90, 2.5],
  'Romanian Deadlift': [80, 2.5],
  'Leg Press': [150, 5],
  'Calf Raise': [60, 2.5],
  'Hanging Leg Raise': [0, 0],
  'Cable Fly': [15, 0.5],
};
const EXERCISES = STARTER.map((e) => [
  e.name,
  e.primary_muscle,
  e.secondary_muscle,
  e.is_bodyweight,
  ...(PROGRESSION[e.name] ?? [20, 0.5]),
]);

const DAYS = {
  Push: ['Bench Press', 'Overhead Press', 'Incline Dumbbell Press', 'Lateral Raise', 'Triceps Pushdown', 'Dips'],
  Pull: ['Barbell Row', 'Lat Pulldown', 'Pull-ups', 'Face Pull', 'Dumbbell Curl'],
  Legs: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Calf Raise', 'Hanging Leg Raise'],
};
const ORDER = ['Push', 'Pull', 'Legs'];

let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const round = (n, step) => Math.round(n / step) * step;

const client = connect();
await client.connect();
try {
  const { rows: users } = await client.query('SELECT id FROM "user" WHERE lower(email) = $1', [email]);
  if (!users[0]) {
    console.error(`No account with the email ${email}. Sign up in the app first, then run this again.`);
    process.exit(1);
  }
  const userId = users[0].id;
  const { rows: existing } = await client.query('SELECT count(*)::int AS n FROM sessions WHERE user_id = $1', [
    userId,
  ]);
  if (existing[0].n > 0) {
    console.log(`${email} already has sessions, not seeding.`);
    process.exit(0);
  }
  await client.query('BEGIN');

  const ids = new Map();
  const meta = new Map();
  for (const [name, primary, secondary, bw, start, step] of EXERCISES) {
    const { rows } = await client.query(
      `INSERT INTO exercises (user_id, name, primary_muscle, secondary_muscle, is_bodyweight)
       VALUES ($5,$1,$2,$3,$4) ON CONFLICT (user_id, lower(name)) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [name, primary, secondary, bw, userId]
    );
    ids.set(name, rows[0].id);
    meta.set(name, { bw, start, step });
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const sessions = [];
  // Walk back 70 days, training roughly Mon/Wed/Fri/Sat with the odd skipped day.
  for (let back = 70; back >= 0; back--) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    if (![1, 3, 5, 6].includes(d.getDay())) continue;
    if (rand() < 0.12) continue;
    sessions.push(d);
  }

  let first = true;
  for (let i = 0; i < sessions.length; i++) {
    const d = sessions[i];
    const day = ORDER[i % 3];
    const week = Math.floor((sessions[i] - sessions[0]) / (7 * 86400000));
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const exIds = [], pos = [], num = [], reps = [], weights = [], rpes = [];
    DAYS[day].forEach((name, p) => {
      const m = meta.get(name);
      const nSets = 3 + (rand() < 0.35 ? 1 : 0);
      for (let s = 0; s < nSets; s++) {
        const bwReps = 6 + Math.floor(week / 2) + Math.floor(rand() * 3) - s;
        exIds.push(ids.get(name));
        pos.push(p);
        num.push(s + 1);
        reps.push(m.bw ? Math.max(3, bwReps) : 8 + Math.floor(rand() * 3) - (s === nSets - 1 ? 1 : 0));
        weights.push(m.bw ? null : round(m.start + m.step * week + (rand() < 0.2 ? m.step : 0), 0.25));
        rpes.push(rand() < 0.7 ? Math.min(10, 7 + Math.floor(rand() * 3) + (s === nSets - 1 ? 1 : 0)) : null);
      }
    });

    const note =
      first
        ? 'Felt strong. Shoulder a bit tight on warm-up.'
        : rand() < 0.15
          ? ['Low energy today.', 'Gym was packed, rushed the accessories.', 'Slept badly.'][Math.floor(rand() * 3)]
          : null;
    first = false;

    const { rows } = await client.query(
      'INSERT INTO sessions (user_id, date, label, notes, duration_seconds) VALUES ($5,$1,$2,$3,$4) RETURNING id',
      [date, day, note, rand() < 0.15 ? null : (45 + Math.floor(rand() * 36)) * 60 + Math.floor(rand() * 60), userId]
    );
    await client.query(
      `INSERT INTO sets (user_id, session_id, exercise_id, exercise_position, set_number, reps, weight, rpe)
       SELECT $8::text, $7::int, * FROM unnest($1::int[], $2::int[], $3::int[], $4::int[], $5::numeric[], $6::numeric[])`,
      [exIds, pos, num, reps, weights, rpes, rows[0].id, userId]
    );
  }

  // One stored coaching note, so the session page shows both states.
  await client.query(
    `UPDATE sessions SET coaching_at = now(), coaching_note = $1
     WHERE id = (SELECT id FROM sessions WHERE user_id = $2 ORDER BY date DESC, id DESC OFFSET 1 LIMIT 1)`,
    [
      "1. Effort & quality: RPE sat at 8-9 on the main lifts, which is right. Accessories looked easy.\n\n2. Progression: Small weight bumps across the board, nothing stalled.\n\n3. Balance & gaps: Pulling volume is keeping up with pushing. Calves are the only thing getting ignored.\n\n4. Next session focus: Add a set of calf raises and push the top set of your first lift by one rep.",
      userId,
    ]
  );

  await client.query('COMMIT');
  console.log(`Seeded ${sessions.length} sessions for ${email}.`);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
