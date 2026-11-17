import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './auth';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
}

// The real session check: looks the cookie's token up in the database, so a forged, expired or
// signed-out cookie gets nothing. proxy.ts only checks that a cookie exists, so every page and API
// route must call one of the functions below before touching data.
// Cached per request, so a page and its helpers share one lookup.
export const getUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, email, name } = session.user;
  return { id, email, name };
});

// For pages: sends anyone without a valid session to the login screen.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}

// For API routes: `const user = await getUser(); if (!user) return unauthorised();`
export function unauthorised(): Response {
  return Response.json({ error: 'Unauthorised' }, { status: 401 });
}
