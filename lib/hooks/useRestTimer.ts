'use client';

import { useCallback, useEffect, useState } from 'react';
import { playBeep, unlockBeep, vibrate } from '../beep';

const KEY = 'gym:rest';

interface Running {
  endAt: number;
  total: number;
}

function readStored(): Running | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Running;
    if (typeof v.endAt !== 'number' || typeof v.total !== 'number') return null;
    // A countdown that ended while the page was closed is stale, don't replay the alert.
    return v.endAt > Date.now() ? v : null;
  } catch {
    return null;
  }
}

function store(v: Running | null) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export interface RestTimer {
  active: boolean;
  done: boolean;
  remaining: number;
  total: number;
  start: (seconds: number) => void;
  adjust: (deltaSeconds: number) => void;
  dismiss: () => void;
}

// Countdown based on an end timestamp, so throttled or locked tabs catch up when they wake.
export function useRestTimer(): RestTimer {
  const [running, setRunning] = useState<Running | null>(readStored);
  const [done, setDone] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Unlock audio on the first touch so the end-of-rest beep is allowed to play later.
  useEffect(() => {
    const unlock = () => unlockBeep();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const finish = useCallback(() => {
    setDone(true);
    store(null);
    playBeep();
    vibrate();
  }, []);

  useEffect(() => {
    if (!running || done) return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= running.endAt) finish();
    }, 250);
    return () => clearInterval(id);
  }, [running, done, finish]);

  const start = useCallback((seconds: number) => {
    const n = Date.now();
    const next = { endAt: n + seconds * 1000, total: seconds };
    setNow(n);
    setDone(false);
    setRunning(next);
    store(next);
  }, []);

  const adjust = useCallback(
    (delta: number) => {
      if (!running || done) return;
      const next = { endAt: running.endAt + delta * 1000, total: Math.max(1, running.total + delta) };
      const n = Date.now();
      setNow(n);
      if (next.endAt <= n) {
        finish();
        return;
      }
      setRunning(next);
      store(next);
    },
    [running, done, finish]
  );

  const dismiss = useCallback(() => {
    setRunning(null);
    setDone(false);
    store(null);
  }, []);

  const remaining = running && !done ? Math.max(0, Math.ceil((running.endAt - now) / 1000)) : 0;
  return {
    active: running !== null || done,
    done,
    remaining,
    total: running?.total ?? 0,
    start,
    adjust,
    dismiss,
  };
}
