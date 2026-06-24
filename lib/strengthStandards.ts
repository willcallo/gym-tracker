export type StrengthTier = 'Beginner' | 'Novice' | 'Intermediate' | 'Advanced' | 'Elite' | 'Master';

export const TIERS: StrengthTier[] = [
  'Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite', 'Master',
];

// Thresholds = [Novice, Intermediate, Advanced, Elite, Master] as BW ratio or rep count.
// Below first threshold = Beginner.
// Uses the max weight in ANY weighted exercise with that primary muscle group.
export const MUSCLE_THRESHOLDS: Partial<Record<string, {
  weightedThresholds?: [number, number, number, number, number];
  bwThresholds?: [number, number, number, number, number];
}>> = {
  chest:        { weightedThresholds: [0.75, 1.0,  1.25, 1.75, 2.25] },
  shoulders:    { weightedThresholds: [0.45, 0.65, 0.85, 1.1,  1.4]  },
  triceps:      { weightedThresholds: [0.5,  0.75, 1.0,  1.3,  1.6]  },
  biceps:       { weightedThresholds: [0.3,  0.45, 0.6,  0.8,  1.0]  },
  lats:         { weightedThresholds: [0.5,  0.75, 1.0,  1.35, 1.75], bwThresholds: [3, 8, 15, 20, 25] },
  'upper back': { weightedThresholds: [0.75, 1.0,  1.35, 1.75, 2.15] },
  'lower back': { weightedThresholds: [1.0,  1.5,  2.0,  2.5,  3.0]  },
  quads:        { weightedThresholds: [0.75, 1.25, 1.75, 2.25, 2.75] },
  hamstrings:   { weightedThresholds: [0.75, 1.0,  1.5,  2.0,  2.5]  },
  glutes:       { weightedThresholds: [0.75, 1.25, 1.75, 2.25, 2.75] },
  calves:       { weightedThresholds: [0.75, 1.0,  1.5,  2.0,  2.5]  },
  core:         { bwThresholds: [5, 15, 30, 50, 75] },
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

// maxesByMuscle: muscle group name → { maxWeight (kg, null if only bw), maxReps }
export function computeMuscleTiers(
  maxesByMuscle: Map<string, { maxWeight: number | null; maxReps: number }>,
  bodyweight: number
): Partial<Record<string, StrengthTier>> {
  const result: Partial<Record<string, StrengthTier>> = {};

  for (const [muscle, standard] of Object.entries(MUSCLE_THRESHOLDS)) {
    if (!standard) continue;
    const data = maxesByMuscle.get(muscle);
    if (!data) continue;

    const candidates: StrengthTier[] = [];

    if (standard.weightedThresholds && data.maxWeight != null && data.maxWeight > 0) {
      candidates.push(getTier(data.maxWeight / bodyweight, standard.weightedThresholds));
    }

    if (standard.bwThresholds && data.maxReps > 0) {
      candidates.push(getTier(data.maxReps, standard.bwThresholds));
    }

    if (candidates.length > 0) {
      result[muscle] = candidates.reduce((best, t) =>
        TIERS.indexOf(t) > TIERS.indexOf(best) ? t : best
      );
    }
  }

  return result;
}
