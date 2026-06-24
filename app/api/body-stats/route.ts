import { getUserSettings, getExerciseMaxes } from '@/lib/db';
import { MUSCLE_STANDARDS, computeMuscleTiers } from '@/lib/strengthStandards';

export async function GET() {
  const settings = await getUserSettings();
  if (!settings.bodyweight) {
    return Response.json({ muscleTiers: {}, settings });
  }

  const allNames = [
    ...new Set(
      Object.values(MUSCLE_STANDARDS).flatMap((s) =>
        s ? [...(s.weightedExercises ?? []), ...(s.bwExercises ?? [])] : []
      )
    ),
  ];

  const maxes = await getExerciseMaxes(allNames);
  const muscleTiers = computeMuscleTiers(maxes, settings.bodyweight);
  return Response.json({ muscleTiers, settings });
}
