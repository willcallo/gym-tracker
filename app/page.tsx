export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getSessionsPage } from '@/lib/db';
import SessionCard from './components/SessionCard';
import StartSession from './components/StartSession';
import { EmptyState, SectionTitle } from './components/ui';

export default async function HomePage() {
  const { sessions, nextCursor } = await getSessionsPage(5);

  return (
    <div className="space-y-8">
      <StartSession />

      <section>
        <SectionTitle>Recent sessions</SectionTitle>
        {sessions.length === 0 ? (
          <EmptyState>No sessions yet. Hit Start session to log your first one.</EmptyState>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
            {nextCursor && (
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
