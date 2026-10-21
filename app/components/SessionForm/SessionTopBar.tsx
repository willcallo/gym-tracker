'use client';

import { formatClock, formatElapsed } from '@/lib/format';
import { useElapsed } from '@/lib/hooks/useElapsed';
import { restTimer, useRestRemaining, useRestState } from '@/lib/hooks/useRestTimer';

// Sticky strip at the top of a new session: the session clock, and the rest countdown while one is
// running. It owns its own ticking so the form below is not redrawn every second.
export default function SessionTopBar({ startedAt }: { startedAt: number }) {
  const elapsed = useElapsed(startedAt);
  const rest = useRestState();
  const remaining = useRestRemaining(rest);

  return (
    <div
      className="sticky top-0 z-20 -mx-4 border-b border-gray-200 bg-white/95 px-4 pb-2 backdrop-blur"
      style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-600">Session time</span>
        <span data-testid="session-clock" className="text-xl font-bold tabular-nums text-brand-ink">
          {formatElapsed(elapsed)}
        </span>
      </div>
      {rest.active && (
        <div
          role={rest.done ? 'button' : 'timer'}
          tabIndex={rest.done ? 0 : undefined}
          onClick={rest.done ? restTimer.dismiss : undefined}
          onKeyDown={rest.done ? (e) => (e.key === 'Enter' || e.key === ' ') && restTimer.dismiss() : undefined}
          className={`mt-1.5 flex min-h-11 items-center justify-between rounded-xl bg-brand px-3 text-white ${
            rest.done ? 'motion-safe:animate-pulse' : ''
          }`}
          aria-label={rest.done ? 'Rest over, tap to dismiss' : `Rest, ${remaining} seconds left`}
        >
          <span className="text-sm font-semibold">{rest.done ? 'Rest over' : 'Rest'}</span>
          <span className="text-xl font-bold tabular-nums">{rest.done ? 'Dismiss' : formatClock(remaining)}</span>
        </div>
      )}
    </div>
  );
}
