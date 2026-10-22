import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE_NAME = 'gym_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

// A deployed app with no password set must not quietly serve everything. Locally (not production,
// not Vercel) the gate stays optional; AUTH_DISABLED=1 is the explicit opt-out for a private
// `next start` or Docker run.
export function authMisconfigured(): boolean {
  if (authEnabled() || process.env.AUTH_DISABLED === '1') return false;
  return process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

// Hash both sides first so the comparison is constant time regardless of length.
export function passwordMatches(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  return timingSafeEqual(sha256(input), sha256(expected));
}

// Key is derived from the password, so changing APP_PASSWORD invalidates every session. An optional
// SESSION_SECRET is mixed in so a captured cookie can't be used to guess a weak password offline.
function sign(issuedAt: string): string {
  const key = sha256(
    `gym-tracker-session:${process.env.SESSION_SECRET ?? ''}:${process.env.APP_PASSWORD ?? ''}`
  );
  return createHmac('sha256', key).update(issuedAt).digest('hex');
}

export function createSessionToken(): string {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${sign(issuedAt)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token || !authEnabled()) return false;
  const [issuedAt, sig] = token.split('.');
  if (!issuedAt || !sig) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(issuedAt));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const age = Date.now() - Number(issuedAt);
  return Number.isFinite(age) && age >= 0 && age < COOKIE_MAX_AGE * 1000;
}

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

export function cookieOptions(isHttps: boolean) {
  return {
    httpOnly: true,
    secure: isHttps || process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
}
