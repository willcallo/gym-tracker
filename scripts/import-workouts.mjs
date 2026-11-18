import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { connect } from './_db.mjs';

// Imports past workouts from another app into one account.
//   npm run db:import -- <export file> <account email> [options]
//
// Reads RepCount CSV, Strong CSV, Hevy CSV, or this script's own JSON format (see parseJson below), and writes
// sessions and sets for that one account only. Weights are stored in kg.
//
// Options:
//   --dry-run          Print what would be imported and write nothing.
//   --map <file>       Exercise mapping (JSON). Every exercise name in the export that doesn't match
//                      one of the account's exercises (case-insensitive) must be listed here, either
//                      mapped to an existing exercise or marked to be created. Without it, the script
//                      lists the unmatched names, writes a suggested mapping file to fill in, and stops.
//   --unit kg|lb       Weight unit of the export, when the file doesn't say (Strong, RepCount). Default kg.
//   --source <name>    Name used in client keys. Default: the detected format (strong, hevy, json).
//   --yes              Don't ask for confirmation before writing to a database that isn't local.
//
// Re-running is safe: every imported session gets client_key "import:<source>:<date>:<n>" (n counts
// workouts on that date in start-time order), and sessions whose key already exists are skipped.

const MUSCLES = [
  'chest', 'shoulders', 'triceps', 'biceps', 'lats', 'upper back', 'lower back',
  'quads', 'hamstrings', 'glutes', 'calves', 'core', 'cardio',
];
const SET_TYPES = ['normal', 'warmup', 'dropset', 'failure'];
const LB = 0.45359237;

// ---------- arguments ----------

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--dry-run' || a === '--yes') flags[a.slice(2)] = true;
  else if (a === '--map' || a === '--unit' || a === '--source') flags[a.slice(2)] = args[++i];
  else if (a.startsWith('--')) fail(`Unknown option ${a}`);
  else positional.push(a);
}
const [file, rawEmail] = positional;
if (!file || !rawEmail) {
  fail('Usage: npm run db:import -- <export file> <account email> [--dry-run] [--map mapping.json] [--unit kg|lb]');
}
const email = rawEmail.trim().toLowerCase();
const unit = (flags.unit ?? 'kg').toLowerCase();
if (!['kg', 'lb', 'lbs'].includes(unit)) fail('--unit must be kg or lb');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

// ---------- parsing ----------

// RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes. Delimiter is , or ;.
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.slice(0, text.indexOf('\n') >>> 0);
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  const header = rows.shift()?.map((h) => h.trim()) ?? [];
  return { header, records: rows.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()]))) };
}

const num = (s) => {
  if (s == null || s === '') return null;
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, '0');

// Wall-clock date and time as written in the export, with no time zone conversion, so a workout
// lands on the date the app showed.
function parseStamp(s) {
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return stamp(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  m = s.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m && MONTHS[m[2].toLowerCase()]) return stamp(+m[3], MONTHS[m[2].toLowerCase()], +m[1], +m[4], +m[5], +(m[6] ?? 0));
  return null;
}
function stamp(y, mo, d, h, mi, s) {
  return { date: `${y}-${pad(mo)}-${pad(d)}`, sort: `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}`, secs: Date.UTC(y, mo - 1, d, h, mi, s) / 1000 };
}

// "1h 5m", "45m", "50s", or plain seconds.
function parseDuration(s) {
  if (!s) return null;
  if (/^\d+$/.test(s)) return +s;
  let total = 0, any = false;
  for (const [, n, u] of s.matchAll(/(\d+)\s*([hms])/gi)) {
    total += +n * { h: 3600, m: 60, s: 1 }[u.toLowerCase()];
    any = true;
  }
  return any ? total : null;
}

// Workouts are built as { start, label, notes, duration_seconds, blocks: [{ name, sets }] }, where
// each set is { reps, weight (kg or null), rpe, set_type } or { skip: reason }.
// category is the source app's muscle group for the exercise, used to guess primary_muscle.
function addSet(workout, name, set, category = null) {
  const last = workout.blocks.at(-1);
  if (last && last.name === name) last.sets.push(set);
  else workout.blocks.push({ name, category, sets: [set] });
}

function parseStrong({ header, records }) {
  const unitCol = header.includes('Weight Unit');
  const workouts = new Map();
  for (const r of records) {
    const start = parseStamp(r['Date']);
    if (!start) throw new Error(`Unreadable date "${r['Date']}"`);
    const key = `${r['Date']}|${r['Workout Name']}`;
    if (!workouts.has(key)) {
      workouts.set(key, {
        start,
        label: r['Workout Name'] || null,
        notes: r['Workout Notes'] || null,
        duration_seconds: parseDuration(r['Duration']),
        blocks: [],
      });
    }
    const order = (r['Set Order'] ?? '').trim();
    if (/rest timer/i.test(order) || /rest timer/i.test(r['Exercise Name'])) continue;
    const set_type = { W: 'warmup', D: 'dropset', F: 'failure' }[order.toUpperCase()] ?? 'normal';
    const reps = num(r['Reps']);
    let weight = num(r['Weight']);
    const u = (unitCol ? r['Weight Unit'] : unit).toLowerCase();
    if (weight != null && u.startsWith('lb')) weight *= LB;
    const set = reps && reps >= 1
      ? { reps: Math.round(reps), weight, rpe: num(r['RPE']), set_type }
      : { skip: num(r['Seconds']) || num(r['Distance']) ? 'timed or distance set (no reps)' : 'no reps' };
    addSet(workouts.get(key), r['Exercise Name'], set);
  }
  return [...workouts.values()];
}

function parseHevy({ header, records }) {
  const lbs = header.includes('weight_lbs');
  const workouts = new Map();
  for (const r of records) {
    const start = parseStamp(r['start_time']);
    if (!start) throw new Error(`Unreadable start_time "${r['start_time']}"`);
    const key = `${r['start_time']}|${r['title']}`;
    if (!workouts.has(key)) {
      const end = r['end_time'] ? parseStamp(r['end_time']) : null;
      workouts.set(key, {
        start,
        label: r['title'] || null,
        notes: r['description'] || null,
        duration_seconds: end ? end.secs - start.secs : null,
        blocks: [],
      });
    }
    const reps = num(r['reps']);
    let weight = num(lbs ? r['weight_lbs'] : r['weight_kg']);
    if (weight != null && lbs) weight *= LB;
    const set_type = SET_TYPES.includes(r['set_type']) ? r['set_type'] : 'normal';
    const set = reps && reps >= 1
      ? { reps: Math.round(reps), weight, rpe: num(r['rpe']), set_type }
      : { skip: num(r['duration_seconds']) || num(r['distance_km']) || num(r['distance_miles']) ? 'timed or distance set (no reps)' : 'no reps' };
    addSet(workouts.get(key), r['exercise_title'], set);
  }
  return [...workouts.values()];
}

// Own format, for converting anything else:
// [{ "start": "2024-03-26T07:12", "label": "Push", "notes": null, "duration_seconds": 3600,
//    "exercises": [{ "name": "Bench Press", "sets": [{ "reps": 8, "weight_kg": 80, "rpe": 8, "set_type": "normal" }] }] }]
function parseJson(data) {
  return data.map((w) => {
    const start = parseStamp(w.start ?? w.date ?? '');
    if (!start) throw new Error(`Unreadable start "${w.start ?? w.date}"`);
    const workout = { start, label: w.label ?? null, notes: w.notes ?? null, duration_seconds: w.duration_seconds ?? null, blocks: [] };
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        addSet(workout, ex.name, s.reps >= 1
          ? { reps: Math.round(s.reps), weight: s.weight_kg ?? null, rpe: s.rpe ?? null, set_type: SET_TYPES.includes(s.set_type) ? s.set_type : 'normal' }
          : { skip: 'no reps' });
      }
    }
    return workout;
  });
}

// RepCount: one row per set, newest workout first. Weights in kg, no set types; a set whose note
// starts with "Drop" is taken as a drop set. Other set notes are kept in the session's notes.
// Columns: Workout Start, Workout End, Exercise, Weight, Reps, Notes, Kcal, Distance, Duration,
// Category, Name, Bodyweight (the person's own body weight, not used).
function parseRepcount({ records }) {
  const workouts = new Map();
  for (const r of records) {
    const start = parseStamp(r['Workout Start']);
    if (!start) throw new Error(`Unreadable Workout Start "${r['Workout Start']}"`);
    const key = r['Workout Start'];
    if (!workouts.has(key)) {
      const end = r['Workout End'] ? parseStamp(r['Workout End']) : null;
      workouts.set(key, {
        start,
        label: r['Name'] || null,
        notes: null,
        setNotes: [],
        duration_seconds: end ? end.secs - start.secs : null,
        blocks: [],
      });
    }
    const w = workouts.get(key);
    const note = r['Notes'];
    const drop = /^drop/i.test(note);
    if (note && !/^drop( set)?$/i.test(note)) w.setNotes.push(`${r['Exercise']}: ${note}`);
    const reps = num(r['Reps']);
    let weight = num(r['Weight']);
    if (weight != null && unit.startsWith('lb')) weight *= LB;
    const set = reps && reps >= 1
      ? { reps: Math.round(reps), weight, rpe: null, set_type: drop ? 'dropset' : 'normal' }
      : { skip: num(r['Duration']) || num(r['Distance']) ? 'timed or distance set (no reps)' : 'no reps' };
    addSet(w, r['Exercise'], set, r['Category'] || null);
  }
  const list = [...workouts.values()];
  for (const w of list) {
    // Notes repeat on every row of a set, so dedupe while keeping order.
    const lines = [...new Set(w.setNotes)];
    if (lines.length) w.notes = lines.join('\n');
    delete w.setNotes;
  }
  return list;
}

function readExport(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (/\.json$/i.test(file)) return { format: 'json', workouts: parseJson(JSON.parse(text)) };
  const csv = parseCsv(text);
  if (csv.header.includes('Exercise Name') && csv.header.includes('Set Order')) return { format: 'strong', workouts: parseStrong(csv) };
  if (csv.header.includes('exercise_title') && csv.header.includes('start_time')) return { format: 'hevy', workouts: parseHevy(csv) };
  if (csv.header.includes('Workout Start') && csv.header.includes('Exercise')) return { format: 'repcount', workouts: parseRepcount(csv) };
  fail(`Don't recognise this export. Columns: ${csv.header.join(', ')}`);
}

// ---------- exercise matching ----------

// Strips equipment suffixes like "(Barbell)" to suggest an existing exercise.
// Also ignores punctuation and plurals, so "Pull Up" suggests "Pull-ups".
const baseName = (n) =>
  n.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
    .split(' ').map((w) => w.replace(/(ch|sh|x)es$/, '$1').replace(/(?<=..)(?<!s)s$/, '')).join('');

const MUSCLE_GUESS = [
  [/calf|calves/i, 'calves'],
  [/crunch|plank|ab |abs|sit[- ]?up|leg raise|knee raise|oblique|russian twist|wood ?chop|rollout|hollow|pallof|dead ?bug/i, 'core'],
  [/hip thrust|glute|kickback|abduct/i, 'glutes'],
  [/romanian|rdl|stiff|leg curl|hamstring|good ?morning|nordic/i, 'hamstrings'],
  [/squat|leg press|lunge|leg extension|split|step[- ]?up|hack|adduct/i, 'quads'],
  [/deadlift|back extension|hyperextension/i, 'lower back'],
  [/pull[- ]?up|chin[- ]?up|pulldown|pullover|lat /i, 'lats'],
  [/row|face pull|shrug|rear delt|reverse fly|t-bar/i, 'upper back'],
  [/curl/i, 'biceps'],
  [/tricep|pushdown|skull|dip|close grip|kickback|extension/i, 'triceps'],
  [/bench|chest|fly|flye|push[- ]?up|pec/i, 'chest'],
  [/overhead|shoulder|military|lateral|front raise|arnold|upright/i, 'shoulders'],
  [/run|row(ing)? machine|bike|cycl|elliptical|treadmill|stair|walk|swim|cardio|jump rope|ski/i, 'cardio'],
];
// The source app's own category (RepCount's "Back", "Legs", ...) narrows the guess: a name-based
// guess is used only if it fits the category, otherwise the category's usual muscle.
const CATEGORY_MUSCLES = {
  back: ['lats', 'upper back', 'lower back'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  shoulders: ['shoulders', 'upper back'],
  abs: ['core'], core: ['core'],
  chest: ['chest'], biceps: ['biceps'], triceps: ['triceps'],
  cardio: ['cardio'], calves: ['calves'], glutes: ['glutes'],
};
const guessMuscle = (name, category) => {
  const byName = MUSCLE_GUESS.find(([re]) => re.test(name))?.[1] ?? null;
  const allowed = CATEGORY_MUSCLES[category?.toLowerCase()];
  if (!allowed) return byName;
  return allowed.includes(byName) ? byName : allowed[0];
};

// ---------- main ----------

const { format, workouts: parsed } = readExport(file);
const source = (flags.source ?? format).replace(/[^A-Za-z0-9_-]/g, '');

// Number workouts per date in start-time order, for the client key.
parsed.sort((a, b) => a.start.sort.localeCompare(b.start.sort));
const perDate = new Map();
for (const w of parsed) {
  const n = (perDate.get(w.start.date) ?? 0) + 1;
  perDate.set(w.start.date, n);
  w.client_key = `import:${source}:${w.start.date}:${n}`;
}

const mapping = flags.map && fs.existsSync(flags.map) ? JSON.parse(fs.readFileSync(flags.map, 'utf8')) : null;

const client = connect();
await client.connect();
const host = new URL(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL).hostname;
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);

try {
  const { rows: users } = await client.query('SELECT id FROM "user" WHERE lower(email) = $1', [email]);
  if (!users[0]) fail(`No account with the email ${email} on ${host}.`);
  const userId = users[0].id;

  const { rows: existingEx } = await client.query(
    'SELECT id, name, is_bodyweight FROM exercises WHERE user_id = $1 ORDER BY name',
    [userId]
  );
  const byLower = new Map(existingEx.map((e) => [e.name.toLowerCase(), e]));

  // Every distinct exercise name in the export, with how it's used.
  const names = new Map();
  for (const w of parsed) for (const b of w.blocks) {
    const info = names.get(b.name) ?? { sets: 0, weighted: 0, category: b.category };
    for (const s of b.sets) if (!s.skip) { info.sets++; if (s.weight > 0) info.weighted++; }
    names.set(b.name, info);
  }

  // Resolve each name to an existing exercise or a new one.
  const resolved = new Map(); // export name -> { existing } | { create: {...} } | { skip: true }
  const unresolved = [];
  for (const [name, info] of names) {
    const m = mapping?.[name];
    if (m !== undefined) {
      if (m === null || m === 'skip') resolved.set(name, { skip: true });
      else if (typeof m === 'string') {
        const ex = byLower.get(m.toLowerCase());
        if (!ex) fail(`Mapping for "${name}" points to "${m}", which isn't one of this account's exercises.`);
        resolved.set(name, { existing: ex });
      } else {
        const create = {
          name: (m.name ?? name).trim(),
          primary_muscle: m.primary_muscle,
          secondary_muscle: m.secondary_muscle ?? null,
          is_bodyweight: m.is_bodyweight ?? info.weighted === 0,
        };
        if (!MUSCLES.includes(create.primary_muscle)) fail(`"${name}": primary_muscle must be one of ${MUSCLES.join(', ')}`);
        if (create.secondary_muscle != null && (!MUSCLES.includes(create.secondary_muscle) || create.secondary_muscle === create.primary_muscle)) {
          fail(`"${name}": secondary_muscle must be another of ${MUSCLES.join(', ')}, or null`);
        }
        if (create.name.length < 1 || create.name.length > 80) fail(`"${name}": name must be 1-80 characters`);
        const clash = byLower.get(create.name.toLowerCase());
        resolved.set(name, clash ? { existing: clash } : { create });
      }
    } else if (byLower.has(name.toLowerCase())) {
      resolved.set(name, { existing: byLower.get(name.toLowerCase()) });
    } else if (info.sets === 0) {
      // Only timed or distance sets: nothing to import, so don't ask about it.
      resolved.set(name, { skip: true, empty: true });
    } else {
      unresolved.push(name);
    }
  }

  // Two export names creating the same new exercise share one row.
  const toCreate = new Map();
  for (const r of resolved.values()) if (r.create) {
    const k = r.create.name.toLowerCase();
    if (!toCreate.has(k)) toCreate.set(k, r.create);
    r.create = toCreate.get(k);
  }

  if (unresolved.length) {
    unresolved.sort((a, b) => a.localeCompare(b));
    const suggestion = {};
    for (const name of unresolved) {
      const info = names.get(name);
      const match = existingEx.find((e) => baseName(e.name) === baseName(name));
      suggestion[name] = match
        ? match.name
        : { name: name, primary_muscle: guessMuscle(name, info.category) ?? 'FILL ME IN', secondary_muscle: null, is_bodyweight: info.weighted === 0 };
    }
    // Keep what's already in the mapping file and add the new names.
    const out = { ...(mapping ?? {}), ...suggestion };
    const mapFile = flags.map ?? path.join(path.dirname(path.resolve(file)), `${path.basename(file).replace(/\.[^.]+$/, '')}.mapping.json`);
    fs.writeFileSync(mapFile, JSON.stringify(out, null, 2) + '\n');
    console.log(`${unresolved.length} exercise name(s) in the export don't match this account's exercises:\n`);
    for (const name of unresolved) {
      const s = suggestion[name];
      const info = names.get(name);
      console.log(`  ${name}  (${info.sets} sets)  ->  ${typeof s === 'string' ? `existing "${s}"` : `new, ${s.primary_muscle}${s.is_bodyweight ? ', bodyweight' : ''}`}`);
    }
    console.log(`\nA suggested mapping is in ${mapFile}. For each name, use either:`);
    console.log('  "Existing Exercise Name"                    map to one of your exercises');
    console.log('  { "name", "primary_muscle", ... }           create it (muscles: ' + MUSCLES.join(', ') + ')');
    console.log('  null                                        leave its sets out');
    console.log(`\nYour exercises: ${existingEx.map((e) => e.name).join(', ') || '(none)'}`);
    console.log(`\nThen run again with --map ${mapFile}. Nothing was written.`);
    process.exitCode = 2;
  } else {
    // Build the rows.
    const { rows: keyRows } = await client.query(
      `SELECT client_key FROM sessions WHERE user_id = $1 AND client_key LIKE 'import:%'`,
      [userId]
    );
    const haveKeys = new Set(keyRows.map((r) => r.client_key));
    const { rows: dateRows } = await client.query(
      `SELECT date::text AS date, count(*)::int AS n FROM sessions
       WHERE user_id = $1 AND (client_key IS NULL OR client_key NOT LIKE 'import:%') GROUP BY date`,
      [userId]
    );
    const ownDates = new Map(dateRows.map((r) => [r.date, r.n]));

    const skipped = new Map();
    const bump = (reason) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
    const sessions = [];
    let alreadyImported = 0;
    for (const w of parsed) {
      const blocks = [];
      for (const b of w.blocks) {
        const r = resolved.get(b.name);
        const sets = [];
        for (const s of b.sets) {
          if (s.skip) { bump(s.skip); continue; }
          if (r.skip) { bump(r.empty ? 'set of an exercise with no rep-based sets' : 'exercise left out by mapping'); continue; }
          const bw = r.existing ? r.existing.is_bodyweight : r.create.is_bodyweight;
          if (bw && s.weight > 0) bump('added weight dropped on a bodyweight exercise (set kept)');
          let weight = bw || s.weight == null ? null : Math.round(s.weight * 100) / 100;
          if (weight != null && weight > 9999) { bump('weight over 9999 kg'); continue; }
          let rpe = s.rpe;
          if (rpe != null && !(rpe >= 1 && rpe <= 10)) { bump('RPE outside 1-10 dropped (set kept)'); rpe = null; }
          if (s.reps > 1000) { bump('more than 1000 reps'); continue; }
          sets.push({ reps: s.reps, weight, rpe, set_type: s.set_type });
        }
        if (!sets.length) continue;
        // Repeated blocks of the same exercise stay separate, as in the source app.
        blocks.push({ ref: r, sets });
      }
      if (!blocks.length) { bump('workout with no importable sets (whole workout)'); continue; }
      if (haveKeys.has(w.client_key)) { alreadyImported++; continue; }
      const d = w.duration_seconds;
      sessions.push({
        date: w.start.date,
        label: w.label ? w.label.slice(0, 60) : null,
        notes: w.notes ? w.notes.slice(0, 2000) : null,
        duration_seconds: d != null && d >= 1 && d <= 43200 ? Math.round(d) : null,
        client_key: w.client_key,
        blocks,
      });
    }

    const setCount = sessions.reduce((n, s) => n + s.blocks.reduce((m, b) => m + b.sets.length, 0), 0);
    const overlap = [...new Set(sessions.map((s) => s.date))].filter((d) => ownDates.has(d)).sort();
    const usedNew = new Set();
    for (const s of sessions) for (const b of s.blocks) if (b.ref.create) usedNew.add(b.ref.create);

    console.log(`Database: ${host}`);
    console.log(`Account:  ${email}`);
    console.log(`Export:   ${path.basename(file)} (${format}, ${parsed.length} workouts)`);
    console.log('');
    console.log(`Sessions to import: ${sessions.length}`);
    console.log(`Sets to import:     ${setCount}`);
    if (sessions.length) console.log(`Date range:         ${sessions[0].date} to ${sessions.at(-1).date}`);
    if (alreadyImported) console.log(`Already imported:   ${alreadyImported} session(s), skipped`);
    console.log(`New exercises:      ${usedNew.size}`);
    for (const e of usedNew) {
      console.log(`  ${e.name}  (${e.primary_muscle}${e.secondary_muscle ? ` / ${e.secondary_muscle}` : ''}${e.is_bodyweight ? ', bodyweight' : ''})`);
    }
    const mapped = [...resolved].filter(([n, r]) => r.existing && r.existing.name !== n);
    if (mapped.length) {
      console.log(`Mapped to existing exercises: ${mapped.length}`);
      for (const [n, r] of mapped) console.log(`  ${n}  ->  ${r.existing.name}`);
    }
    if (skipped.size) {
      console.log('Left out / adjusted:');
      for (const [reason, n] of skipped) console.log(`  ${n} × ${reason}`);
    }
    if (overlap.length) {
      console.log(`\nHeads up: you already have sessions logged in Gym Tracker on ${overlap.length} of these dates:`);
      console.log(`  ${overlap.slice(0, 20).join(', ')}${overlap.length > 20 ? `, … (${overlap.length - 20} more)` : ''}`);
      console.log('  Those imports would sit next to them, not replace them.');
    }

    if (flags['dry-run']) {
      console.log('\nDry run: nothing was written.');
    } else if (!sessions.length) {
      console.log('\nNothing to write.');
    } else {
      if (!isLocal && !flags.yes) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await rl.question(`\nWrite this to ${host}? Type "import" to continue: `);
        rl.close();
        if (answer.trim() !== 'import') fail('Cancelled. Nothing was written.');
      }
      await client.query('BEGIN');
      try {
        for (const e of usedNew) {
          const { rows } = await client.query(
            `INSERT INTO exercises (user_id, name, primary_muscle, secondary_muscle, is_bodyweight)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [userId, e.name, e.primary_muscle, e.secondary_muscle, e.is_bodyweight]
          );
          e.id = rows[0].id;
        }
        let inserted = 0, insertedSets = 0;
        for (const s of sessions) {
          const cols = [[], [], [], [], [], [], []];
          s.blocks.forEach((b, pos) => b.sets.forEach((set, i) => {
            cols[0].push(b.ref.existing ? b.ref.existing.id : b.ref.create.id);
            cols[1].push(pos);
            cols[2].push(i + 1);
            cols[3].push(set.reps);
            cols[4].push(set.weight);
            cols[5].push(set.rpe);
            cols[6].push(set.set_type);
          }));
          // Same shape as createSession in lib/db.ts: the session and its sets in one statement,
          // and nothing if the client key already exists.
          const { rowCount } = await client.query(
            `WITH s AS (
               INSERT INTO sessions (user_id, date, label, notes, duration_seconds, client_key)
               VALUES ($8::text, $9, $10, $11, $12, $13)
               ON CONFLICT (user_id, client_key) DO NOTHING
               RETURNING id
             )
             INSERT INTO sets (user_id, session_id, exercise_id, exercise_position, set_number, reps, weight, rpe, set_type)
             SELECT $8::text, s.id, u.* FROM s,
               unnest($1::int[], $2::int[], $3::int[], $4::int[], $5::numeric[], $6::numeric[], $7::text[]) AS u`,
            [...cols, userId, s.date, s.label, s.notes, s.duration_seconds, s.client_key]
          );
          if (rowCount) { inserted++; insertedSets += rowCount; }
        }
        await client.query('COMMIT');
        console.log(`\nImported ${inserted} sessions, ${insertedSets} sets, ${usedNew.size} new exercises.`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  }
} finally {
  await client.end();
}
