# Gym Tracker

A mobile-first workout tracker for one person. Log sessions at the gym, watch your lifts progress, and optionally ask an AI for coaching. Next.js 16, Postgres (`pg`), Tailwind 4, Recharts, Anthropic SDK.

## Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. On Neon use the pooled string (`...-pooler...?sslmode=require`). |
| `DATABASE_URL_UNPOOLED` | no | Direct connection. When set, `db:init`, `db:seed` and `db:reset` use it instead (Neon's Vercel integration sets it). |
| `APP_PASSWORD` | yes when deployed | Turns on the password gate. In `npm run dev` it can stay unset and the gate is off. In production (and on Vercel) a missing password makes every page and API route answer 503 instead of serving data. Changing it signs everyone out. |
| `AUTH_DISABLED` | no | Set to `1` to run a production build (`next start`, Docker) with no password. Only for a private machine. |
| `SESSION_SECRET` | no | Random string mixed into the login cookie signature, so a captured cookie can't be used to guess the password offline. Changing it signs everyone out. |
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

## Making changes: preview, test, ship

**Start every change on a new, descriptively named branch from `master`** (for example `rest-timer-sound`), not by reusing an old branch. Each branch gets its own preview URL and its own pull request, so changes stay separate and you can ship them one at a time.

1. **Push the branch / open a PR.** Vercel builds a temporary preview site and posts its URL on the PR. The build runs `npm run vercel-build`, which applies the schema (`db:init`) to that preview's own database and then builds the app.
2. **Test it on your phone** at the preview URL. The preview has its own copy of your production data (a Neon branch), so nothing you do there touches the real site. The password gate applies to previews too.
3. **Merge the PR into `master`** when you are happy. Vercel rebuilds from `master` with production settings, applies the schema to the production database, and deploys. That is how a change gets onto the main site.
4. **Do not use "Promote to Production" on a preview.** It reuses the preview's build, environment variables and database. Merge instead. If a production deploy turns out to be bad, use Vercel's Instant Rollback: schema changes are additive, so the previous code keeps working.

### Schema changes are automatic, so keep them safe
`lib/schema.sql` runs on every Vercel build (previews and production) and on container start. It must stay additive and idempotent: `CREATE ... IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, new columns nullable or with defaults. `npm run db:init` refuses to run if the file contains `DROP`, `TRUNCATE` or `DELETE FROM`. A destructive change needs a deliberate manual migration, not an edit to this file.

### One-time setup (Vercel + Neon)
1. In Neon, create a project. In Vercel, import this repo and set **Production Branch** to `master`.
2. In Vercel, add the **Neon integration** (Integrations tab) and connect it to the project. Turn on a database branch for each preview deployment. The integration sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` for you; the schema scripts use the unpooled one when it exists.
3. **Required: turn on automatic deletion of old preview branches** in the same integration settings (the exact label may differ, look for the option that deletes Neon branches when their preview deployments are removed). Neon's free tier limits how many branches a project can have. Without auto-delete, old previews pile up until the limit is hit and new preview deployments start failing. Also glance at the Branches page in the Neon console now and then.
4. Remove any `DATABASE_URL` you added by hand earlier, at least for the Preview environment, so previews never point at the production database.
5. Set environment variables:
   - Production: `APP_PASSWORD`, `SESSION_SECRET` (any long random string), `ANTHROPIC_API_KEY`.
   - Preview: `APP_PASSWORD` and `SESSION_SECRET` (the same ones are fine). Leave `ANTHROPIC_API_KEY` unset on Preview unless you want previews spending API credits; the AI buttons simply stay disabled.
6. Push a branch. In the preview's build log you should see `Schema is up to date.`

A database that still has tables from a much older version of this app needs `npm run db:reset` once, because `db:init` would keep the old shape.

## Docker

```bash
docker build -t gym-tracker .
docker run -p 3000:3000 -e DATABASE_URL=... -e APP_PASSWORD=... gym-tracker   # or -e AUTH_DISABLED=1
```

The container runs `db:init` before starting, which is safe because it is idempotent.

## Behaviour worth knowing

- **Password gate**: one shared password, checked in constant time, with a one second delay after each wrong guess (add a Vercel rate limit rule on `/api/login` for a hard limit). Login sets a signed, httpOnly, long-lived cookie (`Secure` on https and in production). Implemented in `proxy.ts`, which replaced `middleware` in Next 16.
- **Rest timer**: starts when you enter the reps for a set. Last session's numbers show as grey hints, and tapping a hint accepts it. The on/off switch is on the session screen and in Settings and is stored in the database, so it follows you across devices. iOS Safari cannot vibrate, and no web page can play sound while the phone is locked, so keep the screen on (the session screen requests a wake lock, which needs https or localhost).
- **Session timer**: a clock starts when you tap Start session and keeps counting through a locked screen. Its length is saved as the session's duration (ignored if the draft sat open for over 6 hours) and shown in History. You can correct it when editing a session. A blank draft that is over 6 hours old and has no reps or weights is deleted silently. A real iPhone Live Activity on the lock screen is not possible from a web app, it needs a native iOS app.
- **Drafts**: an unsaved session autosaves to the browser's local storage. Home offers Resume or Discard.
- **AI** is always on request. Per-session coaching is stored and flagged "may be out of date" if you edit the session afterwards. The "What to train" summary lives on the Exercises tab and records how many sessions it was written from.
- **Exercises** with logged sets can be renamed and edited but not deleted.
