import KioskHomeClient, { VisitPurpose, Badge } from '@/src/components/KioskHomeClient';
import { getVisitPurposes, getBadges, getGlobalActiveVisits } from '@/src/lib/data';

// Ensure the page is revalidated periodically to pick up new data (ISR)
export const revalidate = 30;

export default async function KioskPage() {
  // Fetch data in parallel
  const [purposesData, badgesData, usedBadgesData] = await Promise.all([
    getVisitPurposes(),
    getBadges(),
    getGlobalActiveVisits()
  ]);

  return (
    <KioskHomeClient 
      initialPurposes={purposesData as unknown as VisitPurpose[]} 
      initialBadges={badgesData as unknown as Badge[]}
      initialUsedBadgeNumbers={usedBadgesData}
    />
  );
}
