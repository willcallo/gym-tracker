export const dynamic = 'force-dynamic';

import { requireUser } from '@/lib/session';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getExerciseDetail } from '@/lib/db';
import { parseId } from '@/lib/http';
import { SET_TYPE_LETTERS, capitalize, formatDate, formatPR, formatSet } from '@/lib/format';
import { Card, Chip, EmptyState, PageHeader, SectionTitle } from '../../components/ui';
import ProgressChart from './ProgressChart';
import ExerciseEditor from './ExerciseEditor';

export default async function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = parseId((await params).id);
  if (id === null) notFound();
  const detail = await getExerciseDetail(id);
  if (!detail) notFound();
  const { exercise, points } = detail;

  const latestPR = [...points].reverse().find((p) => p.isPR);
  const prValue = latestPR ? (exercise.is_bodyweight ? latestPR.max_reps : latestPR.top_weight) : null;
  const newestFirst = [...points].reverse();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/exercises" className="inline-flex min-h-12 items-center text-base font-semibold text-brand-ink">
          &lsaquo; Exercises
        </Link>
        <PageHeader
          title={exercise.name}
          subtitle={`${capitalize(exercise.primary_muscle)}${exercise.secondary_muscle ? `, ${exercise.secondary_muscle}` : ''}${
            exercise.is_bodyweight ? ' · bodyweight' : ''
          }`}
          action={
            prValue !== null && latestPR ? (
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-600">PR</p>
                <p className="text-2xl font-bold leading-tight text-brand-ink">
                  {formatPR(prValue, exercise.is_bodyweight)}
                </p>
                <p className="text-xs text-gray-600">{formatDate(latestPR.date)}</p>
              </div>
            ) : undefined
          }
        />
      </div>

      {points.length === 0 ? (
        <EmptyState>Not done yet. Log a session with this exercise to see progress.</EmptyState>
      ) : (
        <>
          <Card>
            <ProgressChart points={points} isBodyweight={exercise.is_bodyweight} />
          </Card>

          <section>
            <SectionTitle>Session by session</SectionTitle>
            <ul className="space-y-3">
              {newestFirst.map((p) => (
                <li key={p.session_id}>
                  <Link
                    href={`/history/${p.session_id}`}
                    className="block rounded-2xl border border-gray-200 bg-white p-4 active:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-semibold">{formatDate(p.date)}</span>
                      <span className="flex items-center gap-2">
                        {p.isPR && <Chip tone="brand">PR</Chip>}
                        {p.label && <Chip>{p.label}</Chip>}
                      </span>
                    </div>
                    <ul className="mt-2 grid grid-cols-2 gap-1.5">
                      {p.sets.map((s, i) => (
                        <li key={i} className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-center text-sm font-medium tabular-nums">
                          {s.set_type !== 'normal' && (
                            <span className="mr-1.5 text-xs font-bold text-gray-600">{SET_TYPE_LETTERS[s.set_type]}</span>
                          )}
                          {formatSet(s, exercise.is_bodyweight)}
                          {s.rpe !== null && <span className="ml-1.5 font-normal text-gray-600">@{s.rpe}</span>}
                        </li>
                      ))}
                    </ul>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <ExerciseEditor key={`${exercise.name}-${exercise.primary_muscle}-${exercise.secondary_muscle}-${exercise.is_bodyweight}`} exercise={exercise} hasHistory={points.length > 0} />
    </div>
  );
}
