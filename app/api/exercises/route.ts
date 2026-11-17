import { getUser, unauthorised } from '@/lib/session';
import { createExercise } from '@/lib/db';
import { badRequest, isPgError, serverError } from '@/lib/http';
import { parseExerciseInput } from '@/lib/validate';

export async function POST(request: Request) {
  try {
    if (!(await getUser())) return unauthorised();
    const parsed = parseExerciseInput(await request.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    const exercise = await createExercise(parsed.value);
    return Response.json({ ...exercise, last_sets: [] }, { status: 201 });
  } catch (e) {
    if (isPgError(e, '23505')) {
      return Response.json({ error: 'An exercise with that name already exists' }, { status: 409 });
    }
    return serverError(e, 'POST /api/exercises');
  }
}
