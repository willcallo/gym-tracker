import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

const PUBLIC_PATHS = new Set(['/login']);

// An optimistic check only: it sees whether a session cookie is present, not whether it is valid.
// It exists to send signed-out visitors to /login without a database query on every request.
// The real check happens next to the data, in each page and API route.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith('/api/auth/')) return NextResponse.next();

  if (getSessionCookie(request)) return NextResponse.next();

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
