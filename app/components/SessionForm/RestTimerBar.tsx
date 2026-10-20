'use client';

import { formatClock } from '@/lib/format';
import type { RestTimer } from '@/lib/hooks/useRestTimer';

// Sits just above the bottom nav so it is always in thumb reach.
export default function RestTimerBar({ timer }: { timer: RestTimer }) {
  const { done, remaining, total } = timer;
  const pct = total > 0 ? Math.min(100, (remaining / total) * 100) : 0;
  const pill =
    'min-h-12 min-w-14 rounded-xl bg-white px-3 text-base font-semibold text-brand-ink active:bg-brand-soft';

  return (
    <div
      role="timer"
      aria-live="off"
      className={`fixed inset-x-0 z-30 mx-auto max-w-xl overflow-hidden rounded-t-2xl bg-brand text-white shadow-[0_-4px_16px_rgba(0,0,0,0.12)] ${
        done ? 'animate-pulse' : ''
      }`}
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {done ? (
          <>
            <p className="flex-1 pl-1 text-2xl font-bold">Rest over</p>
            <button type="button" onClick={timer.dismiss} className={pill}>
              Dismiss
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-label="15 seconds shorter"
              onClick={() => timer.adjust(-15)}
              className={pill}
            >
              -15
            </button>
            <p
              className="flex-1 text-center text-4xl font-bold tabular-nums"
              aria-label={`Rest, ${remaining} seconds left`}
            >
              {formatClock(remaining)}
            </p>
            <button
              type="button"
              aria-label="15 seconds longer"
              onClick={() => timer.adjust(15)}
              className={pill}
            >
              +15
            </button>
            <button type="button" onClick={timer.dismiss} className={pill}>
              Skip
            </button>
          </>
        )}
      </div>
      {!done && (
        <div className="h-1.5 bg-white/30">
          <div className="h-full bg-white transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
