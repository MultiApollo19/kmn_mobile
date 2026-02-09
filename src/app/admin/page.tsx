import AdminDashboardClient from '@/src/components/AdminDashboardClient';

export default function AdminPage() {
  return (
    <AdminDashboardClient
      initialData={{
        visits: [],
        stats: {
          active: 0,
          todayVisits: 0,
          todayAvgTime: '-',
          totalAvgTime: '-'
        }
      }}
    />
  );
}
