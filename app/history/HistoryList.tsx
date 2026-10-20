'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SessionCard from '../components/SessionCard';
import { btn, EmptyState } from '../components/ui';
import { monthLabel } from '@/lib/format';
import type { SessionCursor } from '@/lib/db';
import type { SessionWithSets } from '@/lib/types';

export default function HistoryList({
  initialSessions,
  initialCursor,
}: {
  initialSessions: SessionWithSets[];
  initialCursor: SessionCursor | null;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ beforeDate: cursor.date, beforeId: String(cursor.id), limit: '20' });
      const res = await fetch(`/api/sessions?${qs}`);
      if (!res.ok) throw new Error();
      const data: { sessions: SessionWithSets[]; nextCursor: SessionCursor | null } = await res.json();
      setSessions((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        return [...prev, ...data.sessions.filter((s) => !seen.has(s.id))];
      });
      setCursor(data.nextCursor);
    } catch {
      setError('Could not load more sessions.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || error) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), {
      rootMargin: '600px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, error, loadMore]);

  if (sessions.length === 0) {
    return <EmptyState>No sessions yet. Start one from Home.</EmptyState>;
  }

  return (
    <div className="space-y-3">
      {sessions.map((s, i) => {
        const month = monthLabel(s.date);
        const header = i === 0 || monthLabel(sessions[i - 1].date) !== month;
        return (
          <div key={s.id} className="space-y-3">
            {header && (
              <h2 className={`${i === 0 ? '' : 'pt-3 '}text-sm font-semibold uppercase tracking-wide text-gray-600`}>
                {month}
              </h2>
            )}
            <SessionCard session={s} />
          </div>
        );
      })}

      {cursor && <div ref={sentinel} aria-hidden="true" className="h-1" />}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {cursor ? (
        <button type="button" onClick={loadMore} disabled={loading} className={`${btn('secondary')} w-full`}>
          {loading ? 'Loading...' : 'Load more'}
        </button>
      ) : (
        <p className="py-4 text-center text-sm text-gray-600">That&apos;s everything.</p>
      )}
    </div>
  );
}
