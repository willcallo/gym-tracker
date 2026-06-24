export const dynamic = 'force-dynamic';

import { getUserSettings, getMaxesByMuscleGroup } from '@/lib/db';
import { computeMuscleTiers, TIERS } from '@/lib/strengthStandards';
import BodyMap, { TIER_COLORS, TIER_TEXT } from '../components/BodyMap';
import Link from 'next/link';

const RANKED_MUSCLES = [
  'chest', 'shoulders', 'triceps', 'biceps',
  'lats', 'upper back', 'lower back',
  'quads', 'hamstrings', 'glutes', 'calves', 'core',
] as const;

export default async function BodyPage() {
  const settings = await getUserSettings();

  if (!settings.bodyweight) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Body Stats</h1>
        <div className="rounded-2xl border border-white/10 bg-navcard p-8 text-center space-y-4">
          <p className="text-white/50">
            Set your bodyweight in Settings to unlock strength tier rankings.
          </p>
          <Link
            href="/settings"
            className="inline-block rounded-xl bg-pink px-6 py-3 text-sm font-semibold text-navy hover:brightness-110 transition-all"
          >
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  const maxesByMuscle = await getMaxesByMuscleGroup();
  const muscleTiers = computeMuscleTiers(maxesByMuscle, settings.bodyweight);
  const rankedCount = Object.keys(muscleTiers).length;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Body Stats</h1>
        <p className="text-sm text-white/40 mt-1">
          Based on {settings.bodyweight}kg bodyweight
          {settings.age ? `, age ${settings.age}` : ''}.{' '}
          {rankedCount === 0
            ? 'Log some workouts to see tiers.'
            : `${rankedCount} muscle group${rankedCount === 1 ? '' : 's'} ranked.`}
        </p>
      </div>

      <BodyMap muscleTiers={muscleTiers} />

      <div className="rounded-2xl border border-white/10 bg-navcard p-4">
        <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Tier Legend</p>
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((tier) => (
            <div key={tier} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: TIER_COLORS[tier] }}
              />
              <span className="text-xs font-medium" style={{ color: TIER_TEXT[tier] }}>
                {tier}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-navcard overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-xs font-semibold text-white/30 uppercase tracking-wider">Muscle Breakdown</p>
        </div>
        {RANKED_MUSCLES.map((muscle) => {
          const tier = muscleTiers[muscle];
          return (
            <div
              key={muscle}
              className="flex items-center justify-between px-4 py-3 border-b border-white/5 last:border-0"
            >
              <span className="text-sm text-white/80 capitalize">{muscle}</span>
              {tier ? (
                <span className="text-sm font-semibold" style={{ color: TIER_TEXT[tier] }}>
                  {tier}
                </span>
              ) : (
                <span className="text-sm text-white/20">No data</span>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-white/20 text-center pb-2">
        Tiers based on best lift / bodyweight ratio across representative exercises.
      </p>
    </div>
  );
}
