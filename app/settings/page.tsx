export const dynamic = 'force-dynamic';

import { requireUser } from '@/lib/session';
import { getSettings } from '@/lib/db';
import { PageHeader } from '../components/ui';
import SettingsForm from './SettingsForm';

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsForm initial={settings} email={user.email} />
    </>
  );
}
