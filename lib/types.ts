export const MUSCLE_GROUPS = [
  'chest',
  'shoulders',
  'triceps',
  'biceps',
  'lats',
  'upper back',
  'lower back',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'cardio',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export interface Exercise {
  id: number;
  name: string;
  is_bodyweight: boolean;
  primary_muscle: MuscleGroup;
  secondary_muscle: MuscleGroup | null;
}

export interface SetValues {
  reps: number;
  weight: number | null;
  rpe: number | null;
}

export interface SessionSet extends SetValues {
  id: number;
  set_number: number;
}

export interface ExerciseGroup {
  position: number;
  exercise_id: number;
  exercise_name: string;
  primary_muscle: MuscleGroup;
  secondary_muscle: MuscleGroup | null;
  is_bodyweight: boolean;
  sets: SessionSet[];
}

export interface SessionWithSets {
  id: number;
  date: string;
  label: string | null;
  notes: string | null;
  coaching_note: string | null;
  coaching_at: string | null;
  coaching_stale: boolean;
  exercises: ExerciseGroup[];
}

export interface ExerciseWithLast extends Exercise {
  last_sets: SetValues[];
}

export interface ExerciseOverview extends ExerciseWithLast {
  session_count: number;
  pr: number | null;
  last_date: string | null;
}

export interface TrainingSummary {
  summary: string;
  session_count: number;
  generated_at: string;
}

export interface ExercisePoint {
  session_id: number;
  date: string;
  label: string | null;
  top_weight: number | null;
  max_reps: number;
  volume: number;
  sets: SetValues[];
  isPR: boolean;
}

export interface Settings {
  rest_timer_enabled: boolean;
  rest_seconds: number;
}

export interface SessionInput {
  date: string;
  label: string | null;
  notes: string | null;
  blocks: { exercise_id: number; sets: SetValues[] }[];
}

export interface ExerciseInput {
  name: string;
  is_bodyweight: boolean;
  primary_muscle: MuscleGroup;
  secondary_muscle: MuscleGroup | null;
}
