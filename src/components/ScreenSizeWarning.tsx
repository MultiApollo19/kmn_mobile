'use client';

import { useEffect, useState, useCallback } from 'react';
import { MonitorX } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function ScreenSizeWarning() {
  const pathname = usePathname();

  // Compute initial state using a lazy initializer to avoid calling setState synchronously in an effect
  const computeInvalid = useCallback(() => {
    if (typeof window === 'undefined') return false;
    if (pathname?.startsWith('/admin')) return false;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = width / height;
    const hasTouch = navigator.maxTouchPoints > 0;
    const isDesktopSize = width > 1024 && ratio > 1.45;

    // Exclude Samsung Galaxy Tab A11+ in landscape mode
    const isGalaxyTabA11Landscape =
      width === 1600 && height === 2560 && ratio < 1;

    return !hasTouch || (isDesktopSize && !isGalaxyTabA11Landscape);
  }, [pathname]);

  const [isInvalid, setIsInvalid] = useState<boolean>(false);

  useEffect(() => {
    const checkScreen = () => setIsInvalid(computeInvalid());
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, [computeInvalid, pathname]);

  if (!isInvalid) return null;

  return (
    <div className="fixed inset-0 z-9999 bg-background flex flex-col items-center justify-center p-4 text-center">
      <MonitorX className="w-16 h-16 text-destructive mb-4" />
      <h1 className="text-2xl font-bold mb-2">Aplikacja mobilna</h1>
      <p className="text-muted-foreground max-w-xl">
        Aplikacja przeznaczona jest wyłącznie na urządzenia mobilne.
      </p>
    </div>
  );
}
