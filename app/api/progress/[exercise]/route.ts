import { getAllExercises, getProgressForExercise } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ exercise: string }> }
) {
  try {
    const { exercise } = await params;
    const exerciseId = parseInt(exercise);
    if (isNaN(exerciseId)) return Response.json({ error: 'Invalid exercise id' }, { status: 400 });

    const exercises = getAllExercises();
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return Response.json({ error: 'Exercise not found' }, { status: 404 });

    const progress = getProgressForExercise(exerciseId);
    return Response.json({ exercise: ex, progress });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
