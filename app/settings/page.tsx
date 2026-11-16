export const dynamic = 'force-dynamic';

import { getSettings } from '@/lib/db';
import { PageHeader } from '../components/ui';
import SettingsForm from './SettingsForm';

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsForm initial={settings} />
    </>
  );
}
