export const dynamic = 'force-dynamic';

import { getSessionsPage } from '@/lib/db';
import { PageHeader } from '../components/ui';
import HistoryList from './HistoryList';

export default async function HistoryPage() {
  const { sessions, nextCursor } = await getSessionsPage(20);
  return (
    <>
      <PageHeader title="History" />
      <HistoryList initialSessions={sessions} initialCursor={nextCursor} />
    </>
  );
}
