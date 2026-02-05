import AdminSettingsClient from '@/src/components/AdminSettingsClient';

export const metadata = {
  title: 'Ustawienia - Panel administracyjny',
  description: 'Zarządzaj ustawieniami systemu'
};

export default function SettingsPage() {
  return <AdminSettingsClient />;
}
