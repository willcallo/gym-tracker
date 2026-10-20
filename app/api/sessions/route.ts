import { createSession } from '@/lib/db';
import { badRequest, isPgError, serverError } from '@/lib/http';
import { parseSessionInput } from '@/lib/validate';

export async function POST(request: Request) {
  try {
    const parsed = parseSessionInput(await request.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    const id = await createSession(parsed.value);
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    if (isPgError(e, '23503')) return badRequest('One of the exercises no longer exists');
    return serverError(e, 'POST /api/sessions');
  }
}
