# Gym Tracker

A mobile-first workout tracker I built because I wanted something faster to use between sets than the apps I'd tried. I use it for my own training, logging every session at the gym on my phone.

<!-- Screenshots: add phone screenshots to docs/screenshots/ and uncomment.
<p>
  <img src="docs/screenshots/home.png" width="240" alt="Home screen with week strip">
  <img src="docs/screenshots/session.png" width="240" alt="Logging a session">
  <img src="docs/screenshots/progress.png" width="240" alt="Exercise progress chart">
</p>
-->

## What it does

- **Log a session fast.** Add exercises, enter weight and reps, and last session's numbers show as hints you can tap to accept. Sets can be marked as warm-up, drop set, or to failure.
- **Rest timer and session timer.** The rest timer starts when you finish a set. The session clock keeps running through a locked screen and is saved as the session's duration.
- **Never lose a workout.** Unsaved sessions autosave on the phone, and saves are safe to retry if the gym's signal drops, so a flaky connection can't create duplicate sessions.
- **Track progress.** History of every session, plus a progress chart for each exercise.
- **AI coaching, only when asked.** One tap gets feedback on a session or a summary of what to train next, written by Claude through the Anthropic API. Nothing runs automatically, which keeps API costs down.
- **Private.** The whole app sits behind a password gate.

## Tech stack

| Area | What I used |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Database | Postgres on Neon, queried with raw SQL through `pg` |
| Charts | Recharts |
| AI | Anthropic API (Claude) |
| Hosting | Vercel, with a preview deployment and its own database branch for every pull request |

## How it fits together

- **Pages** live in `app/` (Home, Log, History, Exercises, Settings) and talk to **API routes** in `app/api/`, which validate input (`lib/validate.ts`) before anything touches the database.
- **Data model** (`lib/schema.sql`): `sessions` contain `sets`, and each set points at an `exercises` row. Constraints in the database itself reject bad data (impossible rep counts, negative weights, unknown muscle groups) even if the app has a bug.
- **Schema changes are automatic and additive.** The schema is applied on every deploy, and the init script refuses to run anything destructive (`DROP`, `DELETE`, and so on), so a deploy can't wipe data.
- **Auth** (`proxy.ts`, `lib/auth.ts`): one shared password, compared in constant time, with a signed httpOnly cookie. If the password isn't configured in production the app refuses to serve data rather than running unprotected.
- **Retry-safe saves**: each session carries a client-generated key with a unique index on it, so sending the same save twice creates one session, not two.
- **AI** (`lib/ai.ts`): pulls recent sessions, sends them to Claude with a fixed prompt, and stores the result. Session coaching is flagged as out of date if you edit the session afterwards.

## How I built it

I built this with [Claude Code](https://claude.com/claude-code) as a coding assistant. I decided what the app should do and how it should look, then worked through it one feature at a time. Each change went on its own branch and pull request, I tested it on my phone through its Vercel preview, and merged it when it worked properly at the gym. That's why most commits are authored by Claude and the merges are mine.

## Running it yourself

You need Node 20+ and a Postgres database.

```bash
npm install
echo 'DATABASE_URL=postgres://user:pass@localhost:5432/gym' > .env.local
npm run db:init     # create the tables (safe to repeat)
npm run db:seed     # optional: about 10 weeks of sample sessions
npm run dev         # http://localhost:3000
```

Environment variables, deployment to Vercel and Neon, Docker, and the rules for schema changes are all in the [development guide](docs/DEVELOPMENT.md).
