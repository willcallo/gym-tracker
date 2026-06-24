export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { getDashboardData } from '@/lib/db';
import { getDashboardSummary } from '@/lib/ai';
import SessionCard from './components/SessionCard';
import type { MuscleGroup, PRRecord } from '@/lib/types';

function groupPRsByMuscle(prs: PRRecord[]): Map<MuscleGroup, PRRecord[]> {
  const map = new Map<MuscleGroup, PRRecord[]>();
  for (const pr of prs) {
    const list = map.get(pr.primary_muscle) ?? [];
    list.push(pr);
    map.set(pr.primary_muscle, list);
  }
  return map;
}

async function AISummary() {
  const summary = await getDashboardSummary();
  if (!summary) return null;
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-5">
      <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-3">AI Training Summary</h2>
      <p className="text-sm text-gray-300 leading-relaxed">{summary}</p>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-5">
      <div className="h-3 w-32 bg-gray-800 rounded mb-3 animate-pulse" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-gray-800 rounded animate-pulse" />
        <div className="h-3 w-5/6 bg-gray-800 rounded animate-pulse" />
        <div className="h-3 w-4/6 bg-gray-800 rounded animate-pulse" />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const { recentSessions, prs, sessionCount } = await getDashboardData();
  const prsByMuscle = groupPRsByMuscle(prs);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {sessionCount === 0
              ? 'No sessions yet — log your first workout'
              : `${sessionCount} session${sessionCount !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <Link
          href="/log"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Log Workout
        </Link>
      </div>

      {sessionCount === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800 py-16 text-center">
          <p className="text-gray-500 mb-4">No workouts logged yet.</p>
          <Link href="/log" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
            Log your first session →
          </Link>
        </div>
      ) : (
        <>
          <Suspense fallback={<SummarySkeleton />}>
            <AISummary />
          </Suspense>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Recent Sessions</h2>
              <Link href="/history" className="text-xs text-indigo-400 hover:text-indigo-300">
                View all →
              </Link>
            </div>
            <div className="space-y-3">
              {recentSessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          </section>

          {prs.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                Personal Records
              </h2>
              <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Exercise</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Muscle</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">PR</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(prsByMuscle.entries()).map(([muscle, musclePRs]) =>
                      musclePRs.map((pr, i) => (
                        <tr key={pr.exercise_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="px-4 py-2.5">
                            <Link
                              href={`/progress/${pr.exercise_id}`}
                              className="text-gray-200 hover:text-indigo-400"
                            >
                              {pr.exercise_name}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5">
                            {i === 0 && (
                              <span className="text-xs text-gray-500 capitalize">{muscle}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-yellow-400">
                            {pr.max_weight}kg
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-gray-500">
                            {pr.session_date}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
