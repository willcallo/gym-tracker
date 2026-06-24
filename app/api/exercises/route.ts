import { getAllExercises, createExercise } from '@/lib/db';
import type { MuscleGroup } from '@/lib/types';

export async function GET() {
  try {
    return Response.json(await getAllExercises());
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, is_bodyweight, primary_muscle, secondary_muscle } = body;
    if (!name || !primary_muscle) {
      return Response.json({ error: 'name and primary_muscle are required' }, { status: 400 });
    }
    const exercise = await createExercise(
      name,
      is_bodyweight ?? 0,
      primary_muscle as MuscleGroup,
      secondary_muscle ?? null
    );
    return Response.json(exercise, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Error && (e as NodeJS.ErrnoException & { code?: string }).code === '23505') {
      return Response.json({ error: 'Exercise name already exists' }, { status: 409 });
    }
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
