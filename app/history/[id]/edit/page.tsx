export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getExercisesForLog, getSession, getSettings } from '@/lib/db';
import { parseId } from '@/lib/http';
import { PageHeader } from '../../../components/ui';
import SessionForm from '../../../components/SessionForm/SessionForm';

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) notFound();
  const [session, exercises, settings] = await Promise.all([getSession(id), getExercisesForLog(), getSettings()]);
  if (!session) notFound();

  return (
    <>
      <PageHeader title="Edit session" />
      <SessionForm exercises={exercises} settings={settings} edit={{ session }} />
    </>
  );
}
