# Gym Tracker

A mobile-first workout tracker I built because I wanted something faster to use between sets than the apps I'd tried. I use it for my own training, logging every session at the gym on my phone.

<!-- Screenshots: add phone screenshots to docs/screenshots/ and uncomment.
<p>
  <img src="docs/screenshots/home.png" width="240" alt="Home screen with week strip">
  <img src="docs/screenshots/session.png" width="240" alt="Logging a session">
  <img src="docs/screenshots/progress.png" width="240" alt="Exercise progress chart">
</p>
-->

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. On Neon use the pooled string (`...-pooler...?sslmode=require`). |
| `DATABASE_URL_UNPOOLED` | no | Direct connection. When set, `db:init`, `db:seed` and `db:reset` use it instead (Neon's Vercel integration sets it). |
| `BETTER_AUTH_SECRET` | yes | Long random string (32+ characters, e.g. `openssl rand -base64 32`) that signs login cookies. Changing it signs everyone out. Use a different one for Preview than for Production. |
| `INVITE_CODE` | yes | The code a new person must enter to create an account. With it unset nobody can sign up. Change it to stop further sign-ups with the old code; existing accounts are unaffected. |
| `BETTER_AUTH_URL` | locally | The app's own address, `http://localhost:3000` for local work, your production URL on Vercel. Vercel preview URLs are allowed automatically. `AUTH_ALLOWED_HOSTS` (comma-separated `host:port`) adds more, such as your computer's LAN address for `npm run dev:lan`. |
| `ANTHROPIC_API_KEY` | no | Enables the AI buttons. Without it they are disabled with a short explanation. |
| `RESET_OLD_SCHEMA` | no | One-time switch. `yes` lets a build wipe a database left over from before user accounts. See "Schema changes are automatic". |
| `AI_DAILY_LIMIT` | no | AI requests each account may make per day (default 20, resets at midnight UTC). The API key is shared by everyone, so this caps what one account can spend. |

- **Log a session fast.** Add exercises, enter weight and reps, and last session's numbers show as hints you can tap to accept. Sets can be marked as warm-up, drop set, or to failure.
- **Rest timer and session timer.** The rest timer starts when you finish a set. The session clock keeps running through a locked screen and is saved as the session's duration.
- **Never lose a workout.** Unsaved sessions autosave on the phone, and saves are safe to retry if the gym's signal drops, so a flaky connection can't create duplicate sessions.
- **Track progress.** History of every session, plus a progress chart for each exercise.
- **AI coaching, only when asked.** One tap gets feedback on a session or a summary of what to train next, written by Claude through the Anthropic API. Nothing runs automatically, which keeps API costs down.
- **Private.** The whole app sits behind a password gate.

## Tech stack

You need Node 20+ and a Postgres database.

```bash
npm install
echo 'DATABASE_URL=postgres://user:pass@localhost:5432/gym' > .env.local
npm run db:init     # create the tables (safe to repeat)
npm run dev         # http://localhost:3000, then create an account
npm run db:seed -- you@example.com   # optional: about 10 weeks of sample sessions for that account
```

| Script | What it does |
| --- | --- |
| `npm run db:init` | Creates tables if missing. Idempotent and non-destructive. |
| `npm run db:seed -- <email>` | Adds sample sessions to that account (sign up first). Refuses to run if the account already has sessions. |
| `npm run db:reset` | Drops every app table (old and new) and recreates the schema. Destroys all data. Refuses to touch a non-local database unless you set `ALLOW_RESET=yes`. |
| `npm run test:isolation` | With the app running, signs up two throwaway accounts and checks that neither can see or change the other's data through any route or page, then deletes them. `BASE_URL=https://... INVITE_CODE=...` points it at a deployed preview. Previews are behind Vercel's login wall, so also pass `VERCEL_BYPASS=...` with a Protection Bypass for Automation secret from the Vercel project's Deployment Protection settings. Run it before merging anything that touches `lib/db.ts`. |
| `npm run dev:lan` | Dev server on `0.0.0.0` so a phone on your network can reach it. If Next blocks dev assets from your phone's address, add it to `allowedDevOrigins` in `next.config.ts`. |
| `npm run lint` / `npm run build` | Lint and production build. |

## How it fits together

- **Pages** live in `app/` (Home, Log, History, Exercises, Settings) and talk to **API routes** in `app/api/`, which validate input (`lib/validate.ts`) before anything touches the database.
- **Data model** (`lib/schema.sql`): `sessions` contain `sets`, and each set points at an `exercises` row. Constraints in the database itself reject bad data (impossible rep counts, negative weights, unknown muscle groups) even if the app has a bug.
- **Schema changes are automatic and additive.** The schema is applied on every deploy, and the init script refuses to run anything destructive (`DROP`, `DELETE`, and so on), so a deploy can't wipe data.
- **Auth** (`proxy.ts`, `lib/auth.ts`): one shared password, compared in constant time, with a signed httpOnly cookie. If the password isn't configured in production the app refuses to serve data rather than running unprotected.
- **Retry-safe saves**: each session carries a client-generated key with a unique index on it, so sending the same save twice creates one session, not two.
- **AI** (`lib/ai.ts`): pulls recent sessions, sends them to Claude with a fixed prompt, and stores the result. Session coaching is flagged as out of date if you edit the session afterwards.

## How I built it

1. **Push the branch / open a PR.** Vercel builds a temporary preview site and posts its URL on the PR. The build runs `npm run vercel-build`, which applies the schema (`db:init`) to that preview's own database and then builds the app.
2. **Test it on your phone** at the preview URL. The preview has its own copy of your production data (a Neon branch), so nothing you do there touches the real site. Sign-in applies to previews too.
3. **Merge the PR into `master`** when you are happy. Vercel rebuilds from `master` with production settings, applies the schema to the production database, and deploys. That is how a change gets onto the main site.
4. **Do not use "Promote to Production" on a preview.** It reuses the preview's build, environment variables and database. Merge instead. If a production deploy turns out to be bad, use Vercel's Instant Rollback: schema changes are additive, so the previous code keeps working.

## Running it yourself

One exception, for the move to user accounts: a database that still has the tables from before accounts existed cannot be upgraded in place, so the build stops with a message. Setting `RESET_OLD_SCHEMA=yes` for that environment lets the next build delete those old tables and create the new ones. It only ever acts on a pre-accounts database, so it does nothing once the upgrade has happened; remove it afterwards anyway.

### One-time setup (Vercel + Neon)
1. In Neon, create a project. In Vercel, import this repo and set **Production Branch** to `master`.
2. In Vercel, add the **Neon integration** (Integrations tab) and connect it to the project. Turn on a database branch for each preview deployment. The integration sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` for you; the schema scripts use the unpooled one when it exists.
3. **Required: turn on automatic deletion of old preview branches** in the same integration settings (the exact label may differ, look for the option that deletes Neon branches when their preview deployments are removed). Neon's free tier limits how many branches a project can have. Without auto-delete, old previews pile up until the limit is hit and new preview deployments start failing. Also glance at the Branches page in the Neon console now and then.
4. Remove any `DATABASE_URL` you added by hand earlier, at least for the Preview environment, so previews never point at the production database.
5. Set environment variables:
   - Production: `BETTER_AUTH_SECRET`, `INVITE_CODE`, `BETTER_AUTH_URL` (the production URL), `ANTHROPIC_API_KEY`.
   - Preview: `BETTER_AUTH_SECRET` (a different one) and `INVITE_CODE`. Leave `ANTHROPIC_API_KEY` unset on Preview unless you want previews spending API credits; the AI buttons simply stay disabled.
6. Push a branch. In the preview's build log you should see `Schema is up to date.`

A database that still has tables from a much older version of this app needs `npm run db:reset` once, because `db:init` would keep the old shape.

## iOS app

The iOS app (`ios/`) is a Capacitor shell: a native app whose screen is this website, loaded from the address in `capacitor.config.ts`. A Vercel deploy therefore updates the app with no new build. Native-only features are added in the Xcode project.

You need Xcode, selected with `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.

| Script | What it does |
| --- | --- |
| `npm run ios:sync` | Copies the config into the Xcode project, pointing the app at the production site. Run after changing `capacitor.config.ts` or adding a Capacitor plugin. |
| `npm run ios:sync:dev` | The same, but pointing the app at `http://localhost:3000` (run `npm run dev` too). The simulator can reach your Mac's localhost; a real phone cannot. Run `ios:sync` again before building a release. |
| `npm run ios:open` | Opens the project in Xcode. Press Run there to launch it in a simulator. |

The bundle identifier is `com.willcallo.gymtracker` (`appId` in `capacitor.config.ts` and the Xcode project). It becomes permanent once a build is uploaded to TestFlight.

## Docker

```bash
docker build -t gym-tracker .
docker run -p 3000:3000 -e DATABASE_URL=... -e BETTER_AUTH_SECRET=... -e BETTER_AUTH_URL=http://localhost:3000 -e INVITE_CODE=... gym-tracker
```

The container runs `db:init` before starting, which is safe because it is idempotent.

## Behaviour worth knowing

- **Accounts**: email and password, handled by Better Auth (`lib/auth.ts`), with users and login sessions stored in the same Postgres database. Creating an account needs the invite code. Sign-in attempts are rate limited in production. `proxy.ts` (which replaced `middleware` in Next 16) only redirects signed-out visitors to `/login`; it is not a security check.
- **Rest timer**: starts when you enter the reps for a set. Last session's numbers show as grey hints, and tapping a hint accepts it. The on/off switch is on the session screen and in Settings and is stored in the database, so it follows you across devices. iOS Safari cannot vibrate, and no web page can play sound while the phone is locked, so keep the screen on (the session screen requests a wake lock, which needs https or localhost).
- **Session timer**: a clock starts when you tap Start session and keeps counting through a locked screen. Its length is saved as the session's duration (ignored if the draft sat open for over 6 hours) and shown in History. You can correct it when editing a session. A blank draft that is over 6 hours old and has no reps or weights is deleted silently. A real iPhone Live Activity on the lock screen is not possible from a web app, it needs a native iOS app.
- **Drafts**: an unsaved session autosaves to the browser's local storage. Home offers Resume or Discard.
- **AI** is always on request. Per-session coaching is stored and flagged "may be out of date" if you edit the session afterwards. The "What to train" summary lives on the Exercises tab and records how many sessions it was written from.
- **Exercises** with logged sets can be renamed and edited but not deleted.
