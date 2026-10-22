export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/db';
import { parseId } from '@/lib/http';
import { SET_TYPE_LETTERS, SET_TYPE_NAMES, capitalize, formatDate, formatDuration, formatWeight } from '@/lib/format';
import { Card, Chip, PageHeader } from '../../components/ui';
import SessionActions from './SessionActions';
import CoachingPanel from './CoachingPanel';
import { aiEnabled } from '@/lib/ai';

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) notFound();
  const session = await getSession(id);
  if (!session) notFound();

  return (
    <div className="space-y-4">
      <Link href="/history" className="inline-flex min-h-12 items-center text-base font-semibold text-brand-ink">
        &lsaquo; History
      </Link>
      <PageHeader
        title={formatDate(session.date)}
        subtitle={session.duration_seconds ? `Took ${formatDuration(session.duration_seconds)}` : undefined}
        action={session.label ? <Chip tone="brand">{session.label}</Chip> : undefined}
      />
      {session.notes && <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-800">{session.notes}</p>}
      {session.exercises.map((g) => (
        <Card key={g.position}>
          <Link href={`/exercises/${g.exercise_id}`} className="text-lg font-bold text-brand-ink">
            {g.exercise_name}
          </Link>
          <p className="mb-2 text-sm text-gray-600">{capitalize(g.primary_muscle)}</p>
          {(() => {
            const bw = g.is_bodyweight;
            const cols = bw ? 'grid-cols-[2.5rem_1fr_4rem]' : 'grid-cols-[2.5rem_1fr_1fr_4rem]';
            return (
              <>
                <div
                  className={`grid ${cols} gap-2 border-b border-gray-200 pb-1.5 text-right text-xs font-medium text-gray-600`}
                >
                  <span className="text-left">Set</span>
                  {!bw && <span>Weight</span>}
                  <span>Reps</span>
                  <span>RPE</span>
                </div>
                <ol className="divide-y divide-gray-100">
                  {g.sets.map((s) => (
                    <li key={s.id} className={`grid ${cols} items-center gap-2 py-2 text-right text-lg tabular-nums`}>
                      <span className="flex items-center gap-1 text-left text-base font-semibold text-gray-600">
                        {s.set_number}
                        {s.set_type !== 'normal' && (
                          <span
                            title={SET_TYPE_NAMES[s.set_type]}
                            className="rounded bg-gray-100 px-1 text-[11px] font-bold text-gray-700"
                          >
                            <span aria-hidden="true">{SET_TYPE_LETTERS[s.set_type]}</span>
                            <span className="sr-only">{SET_TYPE_NAMES[s.set_type]}</span>
                          </span>
                        )}
                      </span>
                      {!bw && (
                        <span className="font-semibold">
                          {s.weight === null ? '-' : `${formatWeight(s.weight)} kg`}
                        </span>
                      )}
                      <span className="font-semibold">{s.reps}</span>
                      <span className="text-base text-gray-600">{s.rpe === null ? '' : s.rpe}</span>
                    </li>
                  ))}
                </ol>
              </>
            );
          })()}
        </Card>
      ))}
      <CoachingPanel
        sessionId={session.id}
        initialNote={session.coaching_note}
        initialAt={session.coaching_at}
        initialStale={session.coaching_stale}
        aiEnabled={aiEnabled()}
      />
      <SessionActions id={session.id} />
    </div>
  );
}
