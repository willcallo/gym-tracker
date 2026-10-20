import { COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return res;
}
