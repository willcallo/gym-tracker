import { getAllSessions, getSessionById } from '@/lib/db';
import SessionCard from '../components/SessionCard';
import CoachingNote from '../components/CoachingNote';
import Link from 'next/link';
import type { SessionWithSets } from '@/lib/types';

function groupByMonth(sessions: SessionWithSets[]): Map<string, SessionWithSets[]> {
  const map = new Map<string, SessionWithSets[]>();
  for (const s of sessions) {
    const key = s.date.slice(0, 7); // YYYY-MM
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }
  return map;
}

function monthLabel(key: string) {
  const [year, month] = key.split('-');
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

export default function HistoryPage() {
  const allSessions = getAllSessions();

  if (allSessions.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">No workouts logged yet.</p>
        <Link href="/log" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
          Log your first session →
        </Link>
      </div>
    );
  }

  const fullSessions = allSessions
    .map((s) => getSessionById(s.id))
    .filter(Boolean) as SessionWithSets[];

  const byMonth = groupByMonth(fullSessions);

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">History</h1>
        <Link
          href="/log"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Log Workout
        </Link>
      </div>

      {Array.from(byMonth.entries()).map(([month, sessions]) => (
        <section key={month}>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            {monthLabel(month)}
          </h2>
          <div className="space-y-4">
            {sessions.map((s) => (
              <div key={s.id} id={`session-${s.id}`} className="space-y-2 scroll-mt-20">
                <SessionCard session={s} expanded />
                <CoachingNote sessionId={s.id} initialNote={s.coaching_note} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
