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
  is_bodyweight: number;
  primary_muscle: MuscleGroup;
  secondary_muscle: MuscleGroup | null;
  created_at: string;
}

export interface Session {
  id: number;
  date: string;
  label: string | null;
  notes: string | null;
  coaching_note: string | null;
  coaching_at: string | null;
  created_at: string;
}

export interface ExerciseSetRow {
  id: number;
  session_id: number;
  exercise_id: number;
  exercise_name: string;
  primary_muscle: MuscleGroup;
  secondary_muscle: MuscleGroup | null;
  is_bodyweight_exercise: number;
  set_number: number;
  reps: number;
  weight: number | null;
  is_bodyweight: number;
  rpe: number | null;
  created_at: string;
}

export interface ExerciseGroup {
  exercise_id: number;
  exercise_name: string;
  primary_muscle: MuscleGroup;
  secondary_muscle: MuscleGroup | null;
  is_bodyweight: number;
  sets: {
    id: number;
    set_number: number;
    reps: number;
    weight: number | null;
    is_bodyweight: number;
    rpe: number | null;
  }[];
}

export interface SessionWithSets extends Session {
  exercises: ExerciseGroup[];
}

export interface ProgressPoint {
  date: string;
  session_id: number;
  max_weight: number | null;
  volume: number;
  isPR: boolean;
}

export interface PRRecord {
  exercise_id: number;
  exercise_name: string;
  primary_muscle: MuscleGroup;
  max_weight: number;
  session_date: string;
}
