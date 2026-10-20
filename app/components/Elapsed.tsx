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
