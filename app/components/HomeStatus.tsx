'use client';

import { useSyncExternalStore } from 'react';
import { daysSince, todayISO } from '@/lib/format';

const noopSubscribe = () => () => {};
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function isoFromLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function ago(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

// Today comes from the phone's clock, so this renders after mount.
export default function HomeStatus({ dates, lastLabel }: { dates: string[]; lastLabel: string | null }) {
  const today = useSyncExternalStore(noopSubscribe, todayISO, () => '');
  if (!today || dates.length === 0) return <div className="h-0" aria-hidden="true" />;

  const [y, m, d] = today.split('-').map(Number);
  const now = new Date(y, m - 1, d);
  const monday = new Date(y, m - 1, d - ((now.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => isoFromLocal(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
  const trained = new Set(dates);
  const count = week.filter((w) => trained.has(w)).length;
  const since = daysSince(dates[0], today);

  return (
    <section aria-label="This week" className="rounded-2xl bg-gray-50 p-4">
      <p className="text-base text-gray-800">
        <span className="font-semibold">Last: {lastLabel ?? 'Session'}</span>, {ago(since)}
      </p>
      <ol className="mt-3 grid grid-cols-7 gap-1.5">
        {week.map((w, i) => {
          const done = trained.has(w);
          const isToday = w === today;
          return (
            <li key={w} className="flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-gray-600">{DAY_LETTERS[i]}</span>
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                  done ? 'bg-brand text-white' : 'bg-white text-gray-600'
                } ${isToday ? 'ring-2 ring-brand-ink ring-offset-2 ring-offset-gray-50' : ''}`}
              >
                {done ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                ) : (
                  new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i).getDate()
                )}
                <span className="sr-only">{done ? ' trained' : ' rest day'}{isToday ? ', today' : ''}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-gray-700">
        <span className="font-semibold tabular-nums">{count}</span> session{count === 1 ? '' : 's'} this week
      </p>
    </section>
  );
}
