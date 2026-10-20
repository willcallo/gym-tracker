import { connect } from './_db.mjs';

// Sample data: ~10 weeks of push / pull / legs with slow progression.
// Refuses to run if sessions already exist, so it can't duplicate or clobber real data.

const EXERCISES = [
  // name, primary, secondary, bodyweight, start weight, step per week
  ['Bench Press', 'chest', 'triceps', false, 70, 1.25],
  ['Overhead Press', 'shoulders', 'triceps', false, 40, 1],
  ['Incline Dumbbell Press', 'chest', 'shoulders', false, 24, 0.5],
  ['Lateral Raise', 'shoulders', null, false, 10, 0.25],
  ['Triceps Pushdown', 'triceps', null, false, 30, 1],
  ['Dips', 'chest', 'triceps', true, 0, 0],
  ['Barbell Row', 'upper back', 'biceps', false, 60, 1.25],
  ['Lat Pulldown', 'lats', 'biceps', false, 55, 1.25],
  ['Pull-ups', 'lats', 'biceps', true, 0, 0],
  ['Face Pull', 'upper back', 'shoulders', false, 20, 0.5],
  ['Dumbbell Curl', 'biceps', null, false, 12, 0.25],
  ['Back Squat', 'quads', 'glutes', false, 90, 2.5],
  ['Romanian Deadlift', 'hamstrings', 'glutes', false, 80, 2.5],
  ['Leg Press', 'quads', 'glutes', false, 150, 5],
  ['Calf Raise', 'calves', null, false, 60, 2.5],
  ['Hanging Leg Raise', 'core', null, true, 0, 0],
  ['Cable Fly', 'chest', null, false, 15, 0.5], // never logged, shows up at the bottom
];

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
  const { rows: existing } = await client.query('SELECT count(*)::int AS n FROM sessions');
  if (existing[0].n > 0) {
    console.log('Sessions already exist, not seeding. Run `npm run db:reset` first for a clean slate.');
    process.exit(0);
  }
  await client.query('BEGIN');

  const ids = new Map();
  const meta = new Map();
  for (const [name, primary, secondary, bw, start, step] of EXERCISES) {
    const { rows } = await client.query(
      `INSERT INTO exercises (name, primary_muscle, secondary_muscle, is_bodyweight)
       VALUES ($1,$2,$3,$4) ON CONFLICT (lower(name)) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [name, primary, secondary, bw]
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
    const date = d.toISOString().slice(0, 10);

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
      'INSERT INTO sessions (date, label, notes) VALUES ($1,$2,$3) RETURNING id',
      [date, day, note]
    );
    await client.query(
      `INSERT INTO sets (session_id, exercise_id, exercise_position, set_number, reps, weight, rpe)
       SELECT $7::int, * FROM unnest($1::int[], $2::int[], $3::int[], $4::int[], $5::numeric[], $6::numeric[])`,
      [exIds, pos, num, reps, weights, rpes, rows[0].id]
    );
  }

  // One stored coaching note, so the session page shows both states.
  await client.query(
    `UPDATE sessions SET coaching_at = now(), coaching_note = $1
     WHERE id = (SELECT id FROM sessions ORDER BY date DESC, id DESC OFFSET 1 LIMIT 1)`,
    [
      "1. Effort & quality: RPE sat at 8-9 on the main lifts, which is right. Accessories looked easy.\n\n2. Progression: Small weight bumps across the board, nothing stalled.\n\n3. Balance & gaps: Pulling volume is keeping up with pushing. Calves are the only thing getting ignored.\n\n4. Next session focus: Add a set of calf raises and push the top set of your first lift by one rep.",
    ]
  );

  await client.query('COMMIT');
  console.log(`Seeded ${EXERCISES.length} exercises and ${sessions.length} sessions.`);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
