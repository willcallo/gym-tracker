'use client';

import { useEffect, useState } from 'react';

// Whole seconds since `startedAt` (epoch ms), updated every second. Based on timestamps, so it
// is right after the phone has been locked, and catches up as soon as the tab is visible again.
export function useElapsed(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [startedAt]);

  return startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
}
