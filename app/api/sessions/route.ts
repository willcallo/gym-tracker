import { getUser, unauthorised } from '@/lib/session';
import { createSession, getSessionsPage } from '@/lib/db';
import { badRequest, isPgError, parseId, serverError } from '@/lib/http';
import { isValidDate, parseSessionInput } from '@/lib/validate';

// Cursor-paginated list for History's infinite scroll.
export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) return unauthorised();
    const params = new URL(request.url).searchParams;
    const beforeDate = params.get('beforeDate');
    const beforeId = parseId(params.get('beforeId') ?? '');
    const limit = Math.min(50, Math.max(1, parseInt(params.get('limit') ?? '20', 10) || 20));

    let before;
    if (beforeDate !== null || beforeId !== null) {
      if (!isValidDate(beforeDate) || beforeId === null) return badRequest('Invalid cursor');
      before = { date: beforeDate, id: beforeId };
    }
    return Response.json(await getSessionsPage(user.id, limit, before));
  } catch (e) {
    return serverError(e, 'GET /api/sessions');
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return unauthorised();
    const parsed = parseSessionInput(await request.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    const id = await createSession(user.id, parsed.value);
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    if (isPgError(e, '23503')) return badRequest('One of the exercises no longer exists');
    return serverError(e, 'POST /api/sessions');
  }
}
