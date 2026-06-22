import { getUserSettings, getExerciseMaxes } from '@/lib/db';
import { MUSCLE_STANDARDS, computeMuscleTiers, TIERS } from '@/lib/strengthStandards';
import BodyMap, { TIER_COLORS, TIER_TEXT } from '../components/BodyMap';
import Link from 'next/link';

const RANKED_MUSCLES = [
  'chest', 'shoulders', 'triceps', 'biceps',
  'lats', 'upper back', 'lower back',
  'quads', 'hamstrings', 'glutes', 'calves', 'core',
] as const;

export default function BodyPage() {
  const settings = getUserSettings();

  if (!settings.bodyweight) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Body Stats</h1>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center space-y-4">
          <p className="text-gray-400">
            Set your bodyweight in Settings to see strength tiers.
          </p>
          <Link
            href="/settings"
            className="inline-block rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  const allNames = [
    ...new Set(
      Object.values(MUSCLE_STANDARDS).flatMap((s) =>
        s ? [...(s.weightedExercises ?? []), ...(s.bwExercises ?? [])] : []
      )
    ),
  ];
  const maxes = getExerciseMaxes(allNames);
  const muscleTiers = computeMuscleTiers(maxes, settings.bodyweight);
  const rankedCount = Object.keys(muscleTiers).length;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Body Stats</h1>
        <p className="text-sm text-gray-500 mt-1">
          Based on {settings.bodyweight}kg bodyweight
          {settings.age ? `, age ${settings.age}` : ''}.{' '}
          {rankedCount === 0
            ? 'Log some workouts to see tiers.'
            : `${rankedCount} muscle group${rankedCount === 1 ? '' : 's'} ranked.`}
        </p>
      </div>

      <BodyMap muscleTiers={muscleTiers} />

      {/* Tier legend */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Tier Legend</p>
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((tier) => (
            <div key={tier} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: TIER_COLORS[tier] }}
              />
              <span className="text-xs" style={{ color: TIER_TEXT[tier] }}>
                {tier}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-muscle breakdown */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Muscle Breakdown</p>
        </div>
        {RANKED_MUSCLES.map((muscle) => {
          const tier = muscleTiers[muscle];
          return (
            <div
              key={muscle}
              className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0"
            >
              <span className="text-sm text-gray-300 capitalize">{muscle}</span>
              {tier ? (
                <span className="text-sm font-semibold" style={{ color: TIER_TEXT[tier] }}>
                  {tier}
                </span>
              ) : (
                <span className="text-sm text-gray-600">No data</span>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-600 text-center pb-2">
        Tiers based on best lift / bodyweight ratio across representative exercises.
      </p>
    </div>
  );
}
