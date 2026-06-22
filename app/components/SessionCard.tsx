import Link from 'next/link';
import type { SessionWithSets } from '@/lib/types';

function formatDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function volumeLabel(s: { reps: number; weight: number | null; is_bodyweight: number }) {
  if (s.is_bodyweight) return `${s.reps} reps`;
  return `${s.reps} × ${s.weight}kg`;
}

interface Props {
  session: SessionWithSets;
  expanded?: boolean;
}

export default function SessionCard({ session, expanded = false }: Props) {
  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const musclesSummary = [...new Set(session.exercises.map((e) => e.primary_muscle))].join(', ');

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-gray-100">{formatDate(session.date)}</span>
            {session.label && (
              <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">{session.label}</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-gray-400">
            {session.exercises.length} exercise{session.exercises.length !== 1 ? 's' : ''} · {totalSets} sets
            {musclesSummary && <span className="ml-2 text-gray-500">— {musclesSummary}</span>}
          </p>
        </div>
        {!expanded && (
          <Link
            href={`/history#session-${session.id}`}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            View →
          </Link>
        )}
      </div>

      {/* Expanded: exercise table */}
      {expanded && session.exercises.length > 0 && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-5">
          {session.exercises.map((ex) => (
            <div key={ex.exercise_id}>
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href={`/progress/${ex.exercise_id}`}
                  className="font-medium text-gray-100 hover:text-indigo-400 text-sm"
                >
                  {ex.exercise_name}
                </Link>
                <span className="text-xs text-gray-500">
                  {ex.primary_muscle}
                  {ex.secondary_muscle ? ` / ${ex.secondary_muscle}` : ''}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-x-3 gap-y-1">
                <span className="text-xs text-gray-500">Set</span>
                <span className="text-xs text-gray-500">Volume</span>
                <span className="text-xs text-gray-500">RPE</span>
                <span className="text-xs text-gray-500"></span>
                {ex.sets.map((s) => (
                  <>
                    <span key={`set-${s.id}`} className="text-sm text-gray-400">{s.set_number}</span>
                    <span key={`vol-${s.id}`} className="text-sm text-gray-200">{volumeLabel(s)}</span>
                    <span key={`rpe-${s.id}`} className="text-sm text-gray-400">{s.rpe ?? '—'}</span>
                    <span key={`sp-${s.id}`}></span>
                  </>
                ))}
              </div>
            </div>
          ))}

          {session.notes && (
            <p className="text-sm text-gray-400 italic border-t border-gray-800 pt-3">{session.notes}</p>
          )}
        </div>
      )}

      {/* Coaching note */}
      {session.coaching_note && (
        <div className="border-t border-gray-800 px-5 py-4 bg-indigo-950/30">
          <p className="text-xs font-medium text-indigo-400 mb-1">AI Coach</p>
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{session.coaching_note}</p>
        </div>
      )}
    </div>
  );
}
