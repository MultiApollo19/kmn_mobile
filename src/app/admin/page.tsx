import AdminDashboardClient, { Visit } from '@/src/components/AdminDashboardClient';
import { getAdminDashboardData } from '@/src/lib/data';

// Ensure the page is revalidated periodically to pick up new data (ISR)
export const revalidate = 30;

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
