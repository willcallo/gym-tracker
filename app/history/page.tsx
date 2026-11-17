export const dynamic = 'force-dynamic';

import { requireUser } from '@/lib/session';
import { getSessionsPage } from '@/lib/db';
import { PageHeader } from '../components/ui';
import HistoryList from './HistoryList';

export default async function HistoryPage() {
  const user = await requireUser();
  const { sessions, nextCursor } = await getSessionsPage(user.id, 20);
  return (
    <>
      <PageHeader title="History" />
      <HistoryList initialSessions={sessions} initialCursor={nextCursor} />
    </>
  );
}
