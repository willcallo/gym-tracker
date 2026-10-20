import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAME, authEnabled, verifySessionToken } from '@/lib/auth';

const PUBLIC_PATHS = new Set(['/login', '/api/login']);

export function proxy(request: NextRequest) {
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
