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

      // Check for touch capability
      const hasTouch = navigator.maxTouchPoints > 0;

      // Check for mobile User Agent (optional backup)
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // Logic: 
      // iPad Pro 12.9 Landscape is 1366x1024 (Ratio ~1.33).
      // Standard Laptop 1366x768 (Ratio ~1.77).
      // Full HD 1920x1080 (Ratio ~1.77).
      
      // Screen Size Check:
      // If width > 1024 (Tablet landscape max usually) AND ratio > 1.45 (Wider than typical tablet 4:3)
      // This catches typical laptop/desktop screens (1366+, 16:9 or 16:10)
      const isDesktopSize = width > 1024 && ratio > 1.45;

      // Determine if invalid:
      // 1. If it has NO touch, it's a desktop (unless manually emulated, but regular PC is blocked).
      // 2. If it has touch but matches Desktop Size (Touchscreen Laptops), it's blocked.
      // Exception: If it explicitly says it's a mobile UA, we might trust it? 
      // But typically we want to block "Computer Browser" usage.
      
      const isInvalid = !hasTouch || isDesktopSize;

      setIsInvalid(isInvalid);
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
      <p className="text-muted-foreground max-w-xl">
        Aplikacja przeznaczona jest wyłącznie na urządzenia mobilne.
      </p>
    </div>
  );
}
