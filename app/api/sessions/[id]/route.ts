import { deleteSession, updateSession } from '@/lib/db';
import { badRequest, isPgError, parseId, serverError } from '@/lib/http';
import { parseSessionInput } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    if (id === null) return badRequest('Invalid session id');
    const parsed = parseSessionInput(await request.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    const found = await updateSession(id, parsed.value);
    if (!found) return Response.json({ error: 'Session not found' }, { status: 404 });
    return Response.json({ id });
  } catch (e) {
    if (isPgError(e, '23503')) return badRequest('One of the exercises no longer exists');
    return serverError(e, 'PUT /api/sessions/[id]');
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    if (id === null) return badRequest('Invalid session id');
    const found = await deleteSession(id);
    if (!found) return Response.json({ error: 'Session not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return serverError(e, 'DELETE /api/sessions/[id]');
  }
}
