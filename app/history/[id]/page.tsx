export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/db';
import { parseId } from '@/lib/http';
import { capitalize, formatDate, formatDuration, formatSet } from '@/lib/format';
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
          <ol className="space-y-1">
            {g.sets.map((s) => (
              <li key={s.id} className="flex justify-between text-base">
                <span className="text-gray-600">Set {s.set_number}</span>
                <span className="font-semibold">
                  {formatSet(s, g.is_bodyweight)}
                  {s.rpe !== null && <span className="ml-2 font-normal text-gray-600">RPE {s.rpe}</span>}
                </span>
              </li>
            ))}
          </ol>
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
