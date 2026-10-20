# Gym Tracker

A mobile-first workout tracker for one person. Log sessions at the gym, watch your lifts progress, and optionally ask an AI for coaching. Next.js 16, Postgres (`pg`), Tailwind 4, Recharts, Anthropic SDK.

## Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. On Neon use the pooled string (`...-pooler...?sslmode=require`). |
| `APP_PASSWORD` | no | Turns on the password gate. Leave unset for local dev and the gate is off. Changing it signs everyone out. |
| `ANTHROPIC_API_KEY` | no | Enables the AI buttons. Without it they are disabled with a short explanation. |

For local work put them in `.env.local`.

## Run locally

You need Node 20+ and a Postgres database.

```bash
npm install
echo 'DATABASE_URL=postgres://user:pass@localhost:5432/gym' > .env.local
npm run db:init     # create the tables (safe to repeat)
npm run db:seed     # optional: about 10 weeks of sample sessions
npm run dev         # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run db:init` | Creates tables if missing. Idempotent and non-destructive. |
| `npm run db:seed` | Adds sample data. Refuses to run if any sessions exist. |
| `npm run db:reset` | Drops every app table (old and new) and recreates the schema. Destroys all data. |
| `npm run dev:lan` | Dev server on `0.0.0.0` so a phone on your network can reach it. If Next blocks dev assets from your phone's address, add it to `allowedDevOrigins` in `next.config.ts`. |
| `npm run lint` / `npm run build` | Lint and production build. |

The build needs no network: the Geist font is bundled in `app/fonts`.

## Deploying to Vercel + Neon

1. Create a Neon project and copy the **pooled** connection string.
2. Import the repo in Vercel and set `DATABASE_URL`, `APP_PASSWORD` and (optionally) `ANTHROPIC_API_KEY` for Production and Preview.
3. Create the schema **once, by hand**, against Neon:

   ```bash
   DATABASE_URL='postgres://...neon...' npm run db:init
   DATABASE_URL='postgres://...neon...' npm run db:seed   # optional
   ```

   It is not part of the Vercel build on purpose: every preview build would run DDL against the shared database, and a database hiccup would fail deploys that have nothing to do with the schema.
4. If an earlier version of this app has already touched the database, run `npm run db:reset` once instead of `db:init`, because the old tables have a different shape and `db:init` would keep them.
5. If your database already has the tables from an earlier release, you can add the newer duration column in Neon's SQL editor instead of running a script. It is safe to run more than once:

   ```sql
   ALTER TABLE sessions
     ADD COLUMN IF NOT EXISTS duration_seconds INTEGER
     CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 43200);
   ```
6. Deploy. Every page and API route sits behind the password gate, including previews.

## Docker

```bash
docker build -t gym-tracker .
docker run -p 3000:3000 -e DATABASE_URL=... -e APP_PASSWORD=... gym-tracker
```

The container runs `db:init` before starting, which is safe because it is idempotent.

## Behaviour worth knowing

- **Password gate**: one shared password, checked in constant time. Login sets a signed, httpOnly, long-lived cookie (`Secure` on https and in production). Implemented in `proxy.ts`, which replaced `middleware` in Next 16.
- **Rest timer**: starts when you enter the reps for a set. Last session's numbers show as grey hints, and tapping a hint accepts it. The on/off switch is on the session screen and in Settings and is stored in the database, so it follows you across devices. iOS Safari cannot vibrate, and no web page can play sound while the phone is locked, so keep the screen on (the session screen requests a wake lock, which needs https or localhost).
- **Session timer**: a clock starts when you tap Start session and keeps counting through a locked screen. Its length is saved as the session's duration (ignored if the draft sat open for over 6 hours) and shown in History. You can correct it when editing a session. A blank draft that is over 6 hours old and has no reps or weights is deleted silently. A real iPhone Live Activity on the lock screen is not possible from a web app, it needs a native iOS app.
- **Drafts**: an unsaved session autosaves to the browser's local storage. Home offers Resume or Discard.
- **AI** is always on request. Per-session coaching is stored and flagged "may be out of date" if you edit the session afterwards. The "What to train" summary lives on the Exercises tab and records how many sessions it was written from.
- **Exercises** with logged sets can be renamed and edited but not deleted.
