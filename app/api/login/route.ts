import { authEnabled, authMisconfigured, COOKIE_NAME, cookieOptions, createSessionToken, passwordMatches } from '@/lib/auth';

export async function POST(request: Request) {
  if (authMisconfigured()) return Response.json({ error: 'APP_PASSWORD is not set' }, { status: 503 });
  if (!authEnabled()) return Response.json({ ok: true });

  let password = '';
  try {
    const body = await request.json();
    if (typeof body?.password === 'string') password = body.password;
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!passwordMatches(password)) {
    // Slows down guessing: each wrong attempt costs a second. Pair with a Vercel rate limit rule.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return Response.json({ error: 'Wrong password' }, { status: 401 });
  }

  const isHttps =
    new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  const res = Response.json({ ok: true });
  res.headers.append(
    'Set-Cookie',
    serialize(COOKIE_NAME, createSessionToken(), cookieOptions(isHttps))
  );
  return res;
}

function serialize(
  name: string,
  value: string,
  o: { httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; maxAge: number }
) {
  return [
    `${name}=${value}`,
    `Path=${o.path}`,
    `Max-Age=${o.maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
    o.secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}
