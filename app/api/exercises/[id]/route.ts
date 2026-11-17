import { getUser, unauthorised } from '@/lib/session';
import { deleteExercise, updateExercise } from '@/lib/db';
import { badRequest, isPgError, parseId, serverError } from '@/lib/http';
import { parseExerciseInput } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  try {
    if (!(await getUser())) return unauthorised();
    const id = parseId((await params).id);
    if (id === null) return badRequest('Invalid exercise id');
    const parsed = parseExerciseInput(await request.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    const exercise = await updateExercise(id, parsed.value);
    if (!exercise) return Response.json({ error: 'Exercise not found' }, { status: 404 });
    return Response.json(exercise);
  } catch (e) {
    if (isPgError(e, '23505')) {
      return Response.json({ error: 'An exercise with that name already exists' }, { status: 409 });
    }
    return serverError(e, 'PUT /api/exercises/[id]');
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    if (!(await getUser())) return unauthorised();
    const id = parseId((await params).id);
    if (id === null) return badRequest('Invalid exercise id');
    const result = await deleteExercise(id);
    if (result === 'not_found') return Response.json({ error: 'Exercise not found' }, { status: 404 });
    if (result === 'has_sets') {
      return Response.json({ error: 'This exercise has logged sets, so it can only be edited' }, { status: 409 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    // 23503: a set was logged between the check and the delete, the FK is RESTRICT
    if (isPgError(e, '23503')) {
      return Response.json({ error: 'This exercise has logged sets, so it can only be edited' }, { status: 409 });
    }
    return serverError(e, 'DELETE /api/exercises/[id]');
  }
}
