'use client';

import { formatElapsed } from '@/lib/format';
import { useElapsed } from '@/lib/hooks/useElapsed';

export default function Elapsed({ since, className = '' }: { since: number; className?: string }) {
  const seconds = useElapsed(since);
  return (
    <span data-testid="session-clock" className={`tabular-nums ${className}`}>
      {formatElapsed(seconds)}
    </span>
  );
}

// A draft younger than six hours shows its running clock; an older one is a forgotten session, so
// say which day it was started instead of a clock reading dozens of hours.
export function DraftAge({ since }: { since: number }) {
  const seconds = useElapsed(since);
  if (seconds < 6 * 3600) {
    return (
      <>
        : <Elapsed since={since} className="font-semibold text-brand-ink" />
      </>
    );
  }
  const day = new Date(since).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  return (
    <>
      {' '}
      from <span className="font-semibold text-brand-ink">{day}</span>
    </>
  );
}
