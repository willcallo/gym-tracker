'use client';

import { useEffect } from 'react';

// Keeps the screen on while `enabled`. Needs a secure context (https or localhost); silently
// does nothing elsewhere. The lock is released by the browser when the tab is hidden, so it is
// requested again when the tab comes back.
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) s.release().catch(() => {});
        else sentinel = s;
      } catch {
        // denied (low battery, no permission): nothing to do
      }
    }
    function onVisible() {
      if (document.visibilityState === 'visible') acquire();
    }

    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
