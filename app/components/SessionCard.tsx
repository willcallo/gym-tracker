import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { Chip } from './ui';
import type { SessionWithSets } from '@/lib/types';

export default function SessionCard({ session }: { session: SessionWithSets }) {
  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const names = session.exercises.map((e) => e.exercise_name);
  const shown = names.slice(0, 3).join(', ');
  const more = names.length > 3 ? ` +${names.length - 3} more` : '';

  return (
    <Link
      href={`/history/${session.id}`}
      className="block rounded-2xl border border-gray-200 bg-white p-4 active:bg-gray-50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold">{formatDate(session.date)}</span>
        {session.label && <Chip tone="brand">{session.label}</Chip>}
      </div>
      <p className="mt-1 text-sm text-gray-700">
        {session.exercises.length} exercise{session.exercises.length === 1 ? '' : 's'} · {totalSets} set
        {totalSets === 1 ? '' : 's'}
      </p>
      {shown && (
        <p className="mt-0.5 truncate text-sm text-gray-600">
          {shown}
          {more}
        </p>
      )}
    </Link>
  );
}
