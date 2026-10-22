import Link from 'next/link';
import { dateParts, formatDate, formatDuration } from '@/lib/format';
import { Chip } from './ui';
import type { SessionWithSets } from '@/lib/types';

export default function SessionCard({ session }: { session: SessionWithSets }) {
  const totalSets = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.set_type !== 'warmup').length, 0);
  const names = session.exercises.map((e) => e.exercise_name);
  const shown = names.slice(0, 3).join(', ');
  const more = names.length > 3 ? ` +${names.length - 3} more` : '';
  const d = dateParts(session.date);

  return (
    <Link
      href={`/history/${session.id}`}
      className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-3 active:bg-gray-50"
    >
      <span className="sr-only">{formatDate(session.date)}</span>
      <div
        aria-hidden="true"
        className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-gray-50 py-2 leading-none"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-gray-600">{d.weekday}</span>
        <span className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{d.day}</span>
        <span className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-600">{d.month}</span>
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-base font-semibold leading-snug text-gray-900">{shown || 'No exercises'}{more}</p>
          {session.label && <Chip tone="brand">{session.label}</Chip>}
        </div>
        <p className="mt-1.5 text-sm text-gray-700">
          <span className="font-semibold tabular-nums">{totalSets}</span> set{totalSets === 1 ? '' : 's'}
          {session.duration_seconds ? (
            <>
              {' · '}
              <span className="font-semibold tabular-nums">{formatDuration(session.duration_seconds)}</span>
            </>
          ) : null}
        </p>
      </div>
    </Link>
  );
}
