export const dynamic = 'force-dynamic';

import { requireUser } from '@/lib/session';
import { getExercisesForLog, getSettings } from '@/lib/db';
import { PageHeader } from '../components/ui';
import SessionForm from '../components/SessionForm/SessionForm';

export default async function LogPage() {
  const user = await requireUser();
  const [exercises, settings] = await Promise.all([getExercisesForLog(), getSettings(user.id)]);
  return (
    <>
      <PageHeader title="New session" />
      <SessionForm exercises={exercises} settings={settings} />
    </>
  );
}
