import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAME, authEnabled, authMisconfigured, verifySessionToken } from '@/lib/auth';

const PUBLIC_PATHS = new Set(['/login', '/api/login']);

export function proxy(request: NextRequest) {
  if (authMisconfigured()) {
    const message = 'APP_PASSWORD is not set. Set it (or AUTH_DISABLED=1 for a private run) and redeploy.';
    if (request.nextUrl.pathname.startsWith('/api/')) return Response.json({ error: message }, { status: 503 });
    return new Response(message, { status: 503 });
  }
  if (!authEnabled()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (verifySessionToken(request.cookies.get(COOKIE_NAME)?.value)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const login = new URL('/login', request.url);
  if (pathname !== '/') login.searchParams.set('next', pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Static assets and the (future) web app manifest and icons are fetched without cookies.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|icon\\.|apple-icon\\.).*)'],
};
