import AdminDashboardClient, { Visit } from '@/src/components/AdminDashboardClient';
import { getAdminDashboardData } from '@/src/lib/data';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const data = await getAdminDashboardData();

  return (
    <AdminDashboardClient 
      initialData={{
        visits: data.visits as unknown as Visit[],
        stats: data.stats
      }}
    />
  );
}
