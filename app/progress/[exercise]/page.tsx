export const dynamic = 'force-dynamic';

import { getAllExercises, getProgressForExercise } from '@/lib/db';
import ProgressChart from '../../components/ProgressChart';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function ProgressPage({
  params,
}: {
  params: Promise<{ exercise: string }>;
}) {
  const { exercise } = await params;
  const exerciseId = parseInt(exercise);
  if (isNaN(exerciseId)) notFound();

  const exercises = await getAllExercises();
  const ex = exercises.find((e) => e.id === exerciseId);
  if (!ex) notFound();

  const progress = await getProgressForExercise(exerciseId);
  const currentPR = progress.filter((p) => p.max_weight !== null).slice(-1)[0];

  const progressByExercise = await Promise.all(
    exercises.map(async (e) => ({ e, len: (await getProgressForExercise(e.id)).length }))
  );
  const allExercisesWithData = progressByExercise.filter((x) => x.len > 0).map((x) => x.e);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{ex.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-indigo-400">
              {ex.primary_muscle}
            </span>
            {ex.secondary_muscle && (
              <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-500">
                {ex.secondary_muscle}
              </span>
            )}
            {ex.is_bodyweight === 1 && (
              <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-500">bodyweight</span>
            )}
          </div>
        </div>
        {currentPR?.max_weight && (
          <div className="text-right">
            <p className="text-xs text-gray-500">Current PR</p>
            <p className="text-2xl font-bold text-yellow-400">{currentPR.max_weight}kg</p>
            <p className="text-xs text-gray-500">{currentPR.date}</p>
          </div>
        )}
      </div>

      <ProgressChart data={progress} exerciseName={ex.name} />

      {progress.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Session History</h2>
          <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Date</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Top Weight</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Volume</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {[...progress].reverse().map((p) => (
                  <tr key={p.session_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2.5 text-gray-300">{p.date}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-200">
                      {p.max_weight !== null ? `${p.max_weight}kg` : '—'}
                      {p.isPR && <span className="ml-1 text-yellow-400 text-xs">★</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400">
                      {Math.round(p.volume).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/history#session-${p.session_id}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {allExercisesWithData.length > 1 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Other Exercises</h2>
          <div className="flex flex-wrap gap-2">
            {allExercisesWithData
              .filter((e) => e.id !== exerciseId)
              .map((e) => (
                <Link
                  key={e.id}
                  href={`/progress/${e.id}`}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-400 hover:border-gray-600 hover:text-gray-200 transition-colors"
                >
                  {e.name}
                </Link>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
