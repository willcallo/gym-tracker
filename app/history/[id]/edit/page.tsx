export const dynamic = 'force-dynamic';

import { requireUser } from '@/lib/session';
import { notFound } from 'next/navigation';
import { getExercisesForLog, getSession } from '@/lib/db';
import { parseId } from '@/lib/http';
import { PageHeader } from '../../../components/ui';
import SessionForm from '../../../components/SessionForm/SessionForm';

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = parseId((await params).id);
  if (id === null) notFound();
  const [session, exercises] = await Promise.all([getSession(user.id, id), getExercisesForLog(user.id)]);
  if (!session) notFound();

  return (
    <>
      <PageHeader title="Edit session" />
      <SessionForm exercises={exercises} settings={{ rest_timer_enabled: false, rest_seconds: 90 }} edit={{ session }} />
    </>
  );
}
