// Checks that one account can never see or change another account's data.
//
//   npm run dev                      (in another terminal)
//   npm run test:isolation
//   BASE_URL=https://my-preview.vercel.app INVITE_CODE=... npm run test:isolation
//
// It signs up two throwaway accounts (A and B) on the running app, gives A some data, then has B
// try every API route and page against A's ids. Both accounts are deleted at the end. It needs
// no database access, so it works against a deployed preview as well as localhost.
// It never triggers a real AI request. Run it before merging anything that touches lib/db.ts.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.INVITE_CODE) {
  try {
    process.loadEnvFile(path.join(root, '.env.local'));
  } catch {
    // no .env.local; the check below reports it
  }
}

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const INVITE_CODE = process.env.INVITE_CODE;
if (!INVITE_CODE) {
  console.error('INVITE_CODE is not set (export it or put it in .env.local).');
  process.exit(1);
}

const run = randomBytes(4).toString('hex');
const PASSWORD = randomBytes(18).toString('base64url');

let passed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) passed++;
  else failures.push(detail ? `${name} (${detail})` : name);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${ok || !detail ? '' : `: ${detail}`}`);
}

// A tiny browser stand-in: remembers the cookies each account is given.
function makeClient(label) {
  const jar = new Map();
  return {
    label,
    async request(method, pathname, body, extraHeaders = {}) {
      const headers = { Origin: BASE, ...extraHeaders };
      if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const res = await fetch(BASE + pathname, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
      });
      for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        const [name, value] = [pair.slice(0, i), pair.slice(i + 1)];
        if (value === '' || /max-age=0/i.test(c)) jar.delete(name);
        else jar.set(name, value);
      }
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        // not JSON (a page)
      }
      return { status: res.status, text, json };
    },
  };
}

async function signUp(client, name) {
  const email = `isolation-${name}-${run}@example.test`;
  const res = await client.request('POST', '/api/auth/sign-up/email', {
    name: `Isolation ${name.toUpperCase()}`,
    email,
    password: PASSWORD,
    inviteCode: INVITE_CODE,
  });
  if (res.status !== 200) {
    throw new Error(`Could not sign up test account ${name}: ${res.status} ${res.text.slice(0, 200)}`);
  }
  return email;
}

const sessionBody = (exerciseId, label, clientKey) => ({
  date: '2026-01-15',
  label,
  client_key: clientKey,
  blocks: [{ exercise_id: exerciseId, sets: [{ reps: 5, weight: 111.25 }] }],
});

const A = makeClient('A');
const B = makeClient('B');
const anon = makeClient('signed out');
// Text that only exists in A's data. If B ever receives it, something leaked.
const A_EXERCISE = `Iso Lift A ${run}`;
const A_LABEL = `iso-a-${run}`;
const B_EXERCISE = `Iso Lift B ${run}`;
const CLIENT_KEY = `iso-key-${run}`;
const leaks = (text) => text.includes(A_EXERCISE) || text.includes(A_LABEL);

console.log(`Isolation test against ${BASE}\n`);
let signedUp = [];
try {
  await signUp(A, 'a');
  signedUp.push(A);
  await signUp(B, 'b');
  signedUp.push(B);

  // ── A's data ───────────────────────────────────────────────
  const aEx = await A.request('POST', '/api/exercises', { name: A_EXERCISE, primary_muscle: 'chest' });
  const bEx = await B.request('POST', '/api/exercises', { name: B_EXERCISE, primary_muscle: 'quads' });
  if (aEx.status !== 201 || bEx.status !== 201) throw new Error('Could not create the test exercises');
  const aExId = aEx.json.id;
  const bExId = bEx.json.id;
  const aSess = await A.request('POST', '/api/sessions', sessionBody(aExId, A_LABEL, CLIENT_KEY));
  if (aSess.status !== 201) throw new Error(`Could not create A's session: ${aSess.status} ${aSess.text}`);
  const aSessId = aSess.json.id;
  await A.request('PUT', '/api/settings', { rest_seconds: 135, rest_timer_enabled: true });

  // ── Signed out, and with a made-up cookie ──────────────────
  console.log('Signed-out and forged requests');
  const forged = { Cookie: 'better-auth.session_token=forged.signature; __Secure-better-auth.session_token=forged.signature' };
  const apiCalls = [
    ['GET', '/api/sessions'],
    ['POST', '/api/sessions', {}],
    ['PUT', `/api/sessions/${aSessId}`, {}],
    ['DELETE', `/api/sessions/${aSessId}`],
    ['POST', `/api/sessions/${aSessId}/coaching`],
    ['POST', '/api/exercises', {}],
    ['PUT', `/api/exercises/${aExId}`, {}],
    ['DELETE', `/api/exercises/${aExId}`],
    ['PUT', '/api/settings', {}],
    ['POST', '/api/training-summary'],
  ];
  for (const [method, p, body] of apiCalls) {
    const none = await anon.request(method, p, body);
    const fake = await anon.request(method, p, body, forged);
    check(`${method} ${p}: 401 signed out, 401 forged`, none.status === 401 && fake.status === 401, `${none.status}, ${fake.status}`);
  }
  const pages = ['/', '/log', '/history', `/history/${aSessId}`, `/history/${aSessId}/edit`, '/exercises', `/exercises/${aExId}`, '/settings'];
  for (const p of pages) {
    const none = await anon.request('GET', p);
    const fake = await anon.request('GET', p, undefined, forged);
    check(
      `GET ${p}: redirects signed out, shows nothing forged`,
      none.status >= 300 && none.status < 400 && !leaks(none.text) && !leaks(fake.text),
      `status ${none.status}`
    );
  }

  // ── B against A's data ─────────────────────────────────────
  console.log("\nB trying to reach A's data");
  const bList = await B.request('GET', '/api/sessions?limit=50');
  check("B's session list has none of A's", bList.status === 200 && !leaks(bList.text) && !bList.json.sessions.some((s) => s.id === aSessId));

  // Reads come before the write attempts below: if one of those wrongly succeeded and removed
  // A's data, a page that leaks it would have nothing left to show and would pass by accident.
  for (const p of pages) {
    const res = await B.request('GET', p);
    check(`B's ${p} shows nothing of A's`, !leaks(res.text));
  }

  const steal = await B.request('POST', '/api/sessions', sessionBody(aExId, `iso-b-steal-${run}`, `iso-steal-${run}`));
  check("B cannot log a session with A's exercise", steal.status === 400, `status ${steal.status}`);

  const sameKey = await B.request('POST', '/api/sessions', sessionBody(bExId, `iso-b-${run}`, CLIENT_KEY));
  check("B reusing A's retry key gets B's own new session", sameKey.status === 201 && sameKey.json.id !== aSessId, `status ${sameKey.status}, id ${sameKey.json?.id}`);

  const upd = await B.request('PUT', `/api/sessions/${aSessId}`, sessionBody(bExId, 'hacked', `iso-upd-${run}`));
  check("B cannot update A's session", upd.status === 404, `status ${upd.status}`);
  const del = await B.request('DELETE', `/api/sessions/${aSessId}`);
  check("B cannot delete A's session", del.status === 404, `status ${del.status}`);
  const coach = await B.request('POST', `/api/sessions/${aSessId}/coaching`);
  // 503 means AI is switched off on this server, which is answered before the session lookup.
  check("B cannot request coaching on A's session", coach.status === 404 || coach.status === 503, `status ${coach.status}`);
  if (coach.status === 503) console.log('        (AI is off here, so this only proves no coaching was produced)');

  const exUpd = await B.request('PUT', `/api/exercises/${aExId}`, { name: 'Hacked', primary_muscle: 'chest' });
  check("B cannot rename A's exercise", exUpd.status === 404, `status ${exUpd.status}`);
  const exDel = await B.request('DELETE', `/api/exercises/${aExId}`);
  check("B cannot delete A's exercise", exDel.status === 404, `status ${exDel.status}`);

  const bSame = await B.request('POST', '/api/exercises', { name: A_EXERCISE, primary_muscle: 'chest' });
  check("B can use the same exercise name as A", bSame.status === 201, `status ${bSame.status}`);
  if (bSame.status === 201) await B.request('DELETE', `/api/exercises/${bSame.json.id}`);

  await B.request('PUT', '/api/settings', { rest_seconds: 45, rest_timer_enabled: false });

  // ── A's data is untouched ──────────────────────────────────
  console.log("\nA's data afterwards");
  const aList = await A.request('GET', '/api/sessions?limit=50');
  const mine = aList.json?.sessions ?? [];
  check('A still has exactly its one session', mine.length === 1 && mine[0].id === aSessId && mine[0].label === A_LABEL, `${mine.length} sessions`);
  check("A's session still has its set", mine[0]?.exercises?.[0]?.sets?.[0]?.weight === 111.25 && mine[0]?.exercises?.[0]?.exercise_name === A_EXERCISE);
  const aSettings = await A.request('PUT', '/api/settings', {});
  check("A's settings were not changed by B", aSettings.json?.rest_seconds === 135 && aSettings.json?.rest_timer_enabled === true, JSON.stringify(aSettings.json));
  const aPage = await A.request('GET', `/history/${aSessId}`);
  check('A can still open its own session page', aPage.text.includes(A_LABEL));
} catch (e) {
  failures.push(`The test could not finish: ${e.message}`);
  console.error(`\n FAIL  ${e.message}`);
} finally {
  // ── Clean up: delete both accounts, which removes all of their data ──
  console.log('\nClean-up');
  for (const client of signedUp) {
    const res = await client.request('POST', '/api/auth/delete-user', { password: PASSWORD }).catch((e) => ({ status: 0, text: e.message }));
    check(`test account ${client.label} deleted`, res.status === 200, `status ${res.status} ${res.text?.slice(0, 120)}`);
  }
  if (signedUp.length) {
    const after = await signedUp[0].request('GET', '/api/sessions').catch(() => ({ status: 0 }));
    check('a deleted account can no longer read data', after.status === 401, `status ${after.status}`);
  }
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nFailed:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
