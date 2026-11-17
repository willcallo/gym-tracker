export const dynamic = 'force-dynamic';

import { requireUser } from '@/lib/session';
import Link from 'next/link';
import { getSessionsPage } from '@/lib/db';
import SessionCard from './components/SessionCard';
import StartSession from './components/StartSession';
import HomeStatus from './components/HomeStatus';
import { EmptyState, SectionTitle } from './components/ui';

export default async function HomePage() {
  const user = await requireUser();
  const { sessions, nextCursor } = await getSessionsPage(user.id, 8);
  const recent = sessions.slice(0, 5);

  return (
    <div className="space-y-8">
      <StartSession />

      <HomeStatus dates={sessions.map((s) => s.date)} lastLabel={sessions[0]?.label ?? null} />

      <section>
        <SectionTitle>Recent sessions</SectionTitle>
        {recent.length === 0 ? (
          <EmptyState>No sessions yet. Hit Start session to log your first one.</EmptyState>
        ) : (
          <div className="space-y-3">
            {recent.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
            {(nextCursor || sessions.length > 5) && (
              <Link
                href="/history"
                className="flex min-h-12 items-center justify-center rounded-xl text-base font-semibold text-brand-ink active:bg-brand-soft"
              >
                See all history
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
