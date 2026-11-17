import { createHash, timingSafeEqual } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { addStarterExercises, pool } from './db';

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

// Hash both sides first so the comparison is constant time regardless of length.
function inviteCodeMatches(input: unknown): boolean {
  const expected = process.env.INVITE_CODE;
  if (!expected || typeof input !== 'string') return false;
  return timingSafeEqual(sha256(input.trim()), sha256(expected));
}

// The app is reached on several hosts (localhost, the production domain, a new URL for every
// Vercel preview), so the base URL comes from the request, limited to hosts we expect.
function allowedHosts(): string[] {
  const hosts = ['localhost:3000', '127.0.0.1:3000'];
  if (process.env.BETTER_AUTH_URL) hosts.push(new URL(process.env.BETTER_AUTH_URL).host);
  for (const v of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (v) hosts.push(v);
  }
  // Comma-separated extras, e.g. a phone reaching `npm run dev:lan` on 192.168.1.20:3000.
  for (const v of (process.env.AUTH_ALLOWED_HOSTS ?? '').split(',')) {
    if (v.trim()) hosts.push(v.trim());
  }
  return hosts;
}

export const auth = betterAuth({
  appName: 'Gym Tracker',
  database: pool,
  baseURL: { allowedHosts: allowedHosts(), fallback: process.env.BETTER_AUTH_URL },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
  // Lets a signed-in user delete their own account by confirming their password. Every table
  // hangs off the user row with ON DELETE CASCADE, so all of their data goes with it.
  user: { deleteUser: { enabled: true } },
  session: {
    expiresIn: 60 * 60 * 24 * 90,
    updateAge: 60 * 60 * 24,
  },
  // In-memory counters do nothing on serverless, where each request can land on a fresh instance.
  rateLimit: { storage: 'database' },
  hooks: {
    // Sign-up is invite-only: without the shared code no account is created.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-up/email') return;
      if (!inviteCodeMatches(ctx.body?.inviteCode)) {
        throw new APIError('FORBIDDEN', { message: 'That invite code is not right' });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        // A new account starts with the standard exercise list. If this fails the account still
        // works, it just starts empty, so the error is logged rather than failing the sign-up.
        after: async (user) => {
          try {
            await addStarterExercises(user.id);
          } catch (e) {
            console.error('[starter exercises]', e);
          }
        },
      },
    },
  },
  // Must stay last: lets auth calls made from server code set cookies.
  plugins: [nextCookies()],
});

// Only allow same-site relative redirects after login. Browsers strip tabs and newlines from URLs,
// so "/\t/evil.com" would otherwise become "//evil.com". Resolve it and compare origins instead.
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || /[\u0000-\u001f\\]/.test(next)) return '/';
  try {
    const base = 'http://gym.invalid';
    const url = new URL(next, base);
    if (url.origin !== base) return '/';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}
