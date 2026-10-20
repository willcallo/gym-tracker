export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getExerciseOverview } from '@/lib/db';
import { aiEnabled } from '@/lib/ai';
import { capitalize, formatDate, formatPR, formatSet } from '@/lib/format';
import { Chip, EmptyState, PageHeader, SectionTitle } from '../components/ui';
import type { ExerciseOverview } from '@/lib/types';
import TrainingSummary from './TrainingSummary';

function ExerciseCard({ e }: { e: ExerciseOverview }) {
  const pr = formatPR(e.pr, e.is_bodyweight);
  return (
    <Link
      href={`/exercises/${e.id}`}
      className="block rounded-2xl border border-gray-200 bg-white p-4 active:bg-gray-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight">{e.name}</h3>
          <p className="mt-0.5 text-sm text-gray-600">
            {capitalize(e.primary_muscle)}
            {e.secondary_muscle ? `, ${e.secondary_muscle}` : ''}
            {e.is_bodyweight ? ' · bodyweight' : ''}
          </p>
        </div>
        {pr && (
          <div className="shrink-0 text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-600">PR</p>
            <p className="text-lg font-bold leading-tight text-brand-ink">{pr}</p>
          </div>
        )}
      </div>

      {e.session_count > 0 && e.last_date ? (
        <>
          <p className="mt-3 text-sm text-gray-600">
            Last done {formatDate(e.last_date)} · {e.session_count} session{e.session_count === 1 ? '' : 's'}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Sets from last time">
            {e.last_sets.map((s, i) => (
              <li
                key={i}
                className="rounded-lg bg-gray-100 px-2.5 py-1 text-sm font-medium tabular-nums text-gray-900"
              >
                {e.is_bodyweight ? `${s.reps} reps` : formatSet(s, false).replace(' kg', '')}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-3">
          <Chip>Not done yet</Chip>
        </div>
      )}
    </Link>
  );
}

export default async function ExercisesPage() {
  const { exercises, summary, sessionCount } = await getExerciseOverview();
  const done = exercises.filter((e) => e.session_count > 0);
  const untouched = exercises.filter((e) => e.session_count === 0);

  return (
    <>
      <PageHeader title="Exercises" subtitle="Most done first. Tap one for its progress." />
      <TrainingSummary initial={summary} sessionCount={sessionCount} aiEnabled={aiEnabled()} />
      {exercises.length === 0 ? (
        <EmptyState>No exercises yet. Create one while logging a session.</EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {done.map((e) => (
              <ExerciseCard key={e.id} e={e} />
            ))}
          </div>
          {untouched.length > 0 && (
            <section>
              <SectionTitle>Not done yet</SectionTitle>
              <div className="space-y-3">
                {untouched.map((e) => (
                  <ExerciseCard key={e.id} e={e} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
