'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { isBeepUnlocked, playBeep, unlockBeep, vibrate } from '../beep';
import { liveActivity } from '../native';

const KEY = 'gym:rest';

interface Running {
  endAt: number;
  total: number;
}

export interface RestState {
  /** Counting down, or finished and waiting to be dismissed. */
  active: boolean;
  done: boolean;
  endAt: number;
  total: number;
}

const IDLE: RestState = { active: false, done: false, endAt: 0, total: 0 };

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

// One countdown for the whole page, outside React. The components that show it re-render on their
// own, so the big session form is not redrawn every quarter second while resting.
let state: RestState = IDLE;
let inited = false;
let timeout: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(next: RestState) {
  state = next;
  listeners.forEach((l) => l());
}

function schedule() {
  clearTimeout(timeout);
  if (!state.active || state.done) return;
  timeout = setTimeout(check, Math.max(0, state.endAt - Date.now()) + 20);
}

function finish() {
  clearTimeout(timeout);
  store(null);
  set({ ...state, done: true });
  liveActivity.rest(null);
  playBeep();
  vibrate();
}

function check() {
  if (state.active && !state.done && Date.now() >= state.endAt) finish();
  else schedule();
}

function init() {
  if (inited || typeof window === 'undefined') return;
  inited = true;
  const stored = readStored();
  if (stored) {
    state = { active: true, done: false, endAt: stored.endAt, total: stored.total };
    schedule();
  } else {
    // A rest that ran out while the app was closed is still on the lock screen; clear it.
    liveActivity.rest(null);
  }
  // Timers are throttled while the tab is hidden; catch up the moment it is visible again.
  document.addEventListener('visibilitychange', check);
  // Unlock audio on touch so the end-of-rest beep is allowed to play later. Keep trying until it works.
  const unlock = () => {
    unlockBeep();
    if (isBeepUnlocked()) window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
}

export const restTimer = {
  start(seconds: number) {
    init();
    const now = Date.now();
    store({ endAt: now + seconds * 1000, total: seconds });
    set({ active: true, done: false, endAt: now + seconds * 1000, total: seconds });
    liveActivity.rest(now + seconds * 1000, seconds);
    schedule();
  },
  adjust(deltaSeconds: number) {
    init();
    if (!state.active || state.done) return;
    const endAt = state.endAt + deltaSeconds * 1000;
    const total = Math.max(1, state.total + deltaSeconds);
    if (endAt <= Date.now()) {
      set({ ...state, endAt, total });
      finish();
      return;
    }
    store({ endAt, total });
    set({ active: true, done: false, endAt, total });
    liveActivity.rest(endAt, total);
    schedule();
  },
  dismiss() {
    init();
    clearTimeout(timeout);
    store(null);
    set(IDLE);
    liveActivity.rest(null);
  },
};

function subscribe(cb: () => void) {
  init();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useRestState(): RestState {
  return useSyncExternalStore(subscribe, () => state, () => IDLE);
}

// Whole seconds left, redrawn four times a second only while a countdown is running.
export function useRestRemaining(rest: RestState): number {
  const [now, setNow] = useState(() => Date.now());
  const running = rest.active && !rest.done;
  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running, rest.endAt]);
  return running ? Math.max(0, Math.ceil((rest.endAt - now) / 1000)) : 0;
}
