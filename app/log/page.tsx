export const dynamic = 'force-dynamic';

import { requireUser } from '@/lib/session';
import { getExercisesForLog, getSettings } from '@/lib/db';
import { PageHeader } from '../components/ui';
import SessionForm from '../components/SessionForm/SessionForm';

export default async function LogPage() {
  await requireUser();
  const [exercises, settings] = await Promise.all([getExercisesForLog(), getSettings()]);
  return (
    <>
      <PageHeader title="New session" />
      <SessionForm exercises={exercises} settings={settings} />
    </>
  );
}
