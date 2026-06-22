export type StrengthTier = 'Beginner' | 'Novice' | 'Intermediate' | 'Advanced' | 'Elite' | 'Master';

export const TIERS: StrengthTier[] = [
  'Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite', 'Master',
];

interface MuscleStandard {
  weightedExercises?: string[];
  weightedThresholds?: [number, number, number, number, number];
  bwExercises?: string[];
  bwThresholds?: [number, number, number, number, number];
}

// Thresholds = [Novice, Intermediate, Advanced, Elite, Master] as BW ratio or rep count.
// Below first threshold = Beginner.
export const MUSCLE_STANDARDS: Partial<Record<string, MuscleStandard>> = {
  chest: {
    weightedExercises: ['Bench Press', 'Incline Bench Press', 'Decline Bench Press'],
    weightedThresholds: [0.75, 1.0, 1.25, 1.75, 2.25],
  },
  shoulders: {
    weightedExercises: ['Overhead Press'],
    weightedThresholds: [0.45, 0.65, 0.85, 1.1, 1.4],
  },
  triceps: {
    weightedExercises: ['Close Grip Bench Press', 'Skull Crusher', 'Tricep Pushdown'],
    weightedThresholds: [0.5, 0.75, 1.0, 1.3, 1.6],
  },
  biceps: {
    weightedExercises: ['Barbell Curl', 'Dumbbell Curl', 'Preacher Curl', 'Hammer Curl'],
    weightedThresholds: [0.3, 0.45, 0.6, 0.8, 1.0],
  },
  lats: {
    weightedExercises: ['Lat Pulldown', 'Straight Arm Pulldown'],
    weightedThresholds: [0.5, 0.75, 1.0, 1.35, 1.75],
    bwExercises: ['Pull-Up', 'Chin-Up'],
    bwThresholds: [3, 8, 15, 20, 25],
  },
  'upper back': {
    weightedExercises: ['Barbell Row', 'Seated Cable Row', 'Dumbbell Row', 'Face Pull'],
    weightedThresholds: [0.75, 1.0, 1.35, 1.75, 2.15],
  },
  'lower back': {
    weightedExercises: ['Deadlift', 'Romanian Deadlift', 'Good Morning'],
    weightedThresholds: [1.0, 1.5, 2.0, 2.5, 3.0],
  },
  quads: {
    weightedExercises: ['Squat', 'Front Squat', 'Hack Squat', 'Bulgarian Split Squat', 'Leg Press'],
    weightedThresholds: [0.75, 1.25, 1.75, 2.25, 2.75],
  },
  hamstrings: {
    weightedExercises: ['Romanian Deadlift', 'Deadlift', 'Leg Curl'],
    weightedThresholds: [0.75, 1.0, 1.5, 2.0, 2.5],
  },
  glutes: {
    weightedExercises: ['Hip Thrust', 'Romanian Deadlift', 'Bulgarian Split Squat'],
    weightedThresholds: [0.75, 1.25, 1.75, 2.25, 2.75],
  },
  calves: {
    weightedExercises: ['Standing Calf Raise', 'Seated Calf Raise'],
    weightedThresholds: [0.75, 1.0, 1.5, 2.0, 2.5],
  },
  core: {
    bwExercises: ['Plank', 'Ab Wheel', 'Hanging Leg Raise', 'Russian Twist'],
    bwThresholds: [5, 15, 30, 50, 75],
  },
};

export function getTier(
  value: number,
  thresholds: [number, number, number, number, number]
): StrengthTier {
  if (value < thresholds[0]) return 'Beginner';
  if (value < thresholds[1]) return 'Novice';
  if (value < thresholds[2]) return 'Intermediate';
  if (value < thresholds[3]) return 'Advanced';
  if (value < thresholds[4]) return 'Elite';
  return 'Master';
}

export function computeMuscleTiers(
  maxes: Map<string, { maxWeight: number | null; maxReps: number }>,
  bodyweight: number
): Partial<Record<string, StrengthTier>> {
  const result: Partial<Record<string, StrengthTier>> = {};

  for (const [muscle, standard] of Object.entries(MUSCLE_STANDARDS)) {
    if (!standard) continue;
    const tiers: StrengthTier[] = [];

    if (standard.weightedExercises && standard.weightedThresholds) {
      for (const name of standard.weightedExercises) {
        const data = maxes.get(name);
        if (data?.maxWeight != null && data.maxWeight > 0) {
          tiers.push(getTier(data.maxWeight / bodyweight, standard.weightedThresholds));
        }
      }
    }

    if (standard.bwExercises && standard.bwThresholds) {
      for (const name of standard.bwExercises) {
        const data = maxes.get(name);
        if (data && data.maxReps > 0) {
          tiers.push(getTier(data.maxReps, standard.bwThresholds));
        }
      }
    }

    if (tiers.length > 0) {
      result[muscle] = tiers.reduce((best, t) =>
        TIERS.indexOf(t) > TIERS.indexOf(best) ? t : best
      );
    }
  }

  return result;
}
