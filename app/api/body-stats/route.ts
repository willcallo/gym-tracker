import { getUserSettings, getMaxesByMuscleGroup } from '@/lib/db';
import { computeMuscleTiers } from '@/lib/strengthStandards';

export async function GET() {
  const settings = await getUserSettings();
  if (!settings.bodyweight) {
    return Response.json({ muscleTiers: {}, settings });
  }

  const maxesByMuscle = await getMaxesByMuscleGroup();
  const muscleTiers = computeMuscleTiers(maxesByMuscle, settings.bodyweight);
  return Response.json({ muscleTiers, settings });
}
