import { getAllExercises, getLastSets } from '@/lib/db';
import WorkoutForm from '../components/WorkoutForm';

export default function LogPage() {
  const exercises = getAllExercises();
  const lastSets = getLastSets();

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-100">Log Workout</h1>
        <p className="text-sm text-gray-500 mt-1">Select exercises and log your sets.</p>
      </div>
      <WorkoutForm exercises={exercises} lastSets={lastSets} />
    </div>
  );
}
