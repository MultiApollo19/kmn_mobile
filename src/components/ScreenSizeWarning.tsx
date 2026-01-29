'use client';

import { useEffect, useState } from 'react';
import { MonitorX } from 'lucide-react';

export default function ScreenSizeWarning() {
  const [isInvalid, setIsInvalid] = useState(false);

  useEffect(() => {
    const checkScreen = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const ratio = width / height;

      // Logic: 
      // iPad Pro 12.9 Landscape is 1366x1024 (Ratio ~1.33).
      // Standard Laptop 1366x768 (Ratio ~1.77).
      // Full HD 1920x1080 (Ratio ~1.77).
      //
      // We want to block laptops/desktops but allow tablets.
      // If width > 1024 (Tablet landscape max usually) AND ratio > 1.45 (Wider than typical tablet 4:3)
      // This catches typical laptop/desktop screens (1366+, 16:9 or 16:10)
      // while allowing iPad Pro 12.9 (Ratio 1.33).

      const isDesktop = width > 1024 && ratio > 1.45;
      setIsInvalid(isDesktop);
    };

    // Initial check
    checkScreen();

    // Listener
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  if (!isInvalid) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-4 text-center">
      <MonitorX className="w-16 h-16 text-destructive mb-4" />
      <h1 className="text-2xl font-bold mb-2">Aplikacja mobilna</h1>
      <p className="text-muted-foreground max-w-md">
        Aplikacja nie jest przystosowana do uruchomienia w przeglądarce komputera.
        <br />
      </p>
    </div>
  );
}
