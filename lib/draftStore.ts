'use client';

import { useSyncExternalStore } from 'react';

export const NEW_DRAFT_KEY = 'gym:draft:new';
export const editDraftKey = (id: number) => `gym:draft:edit:${id}`;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function readDraft(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeDraft(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage full or blocked: autosave just stops working
  }
  notify();
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
  notify();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}

// A new-session draft that was opened more than 6 hours ago and never got a rep or weight
// is an accidental open, not a session in progress.
const STALE_BLANK_MS = 6 * 60 * 60 * 1000;

export function isStaleBlankDraft(raw: string, now = Date.now()): boolean {
  try {
    const d = JSON.parse(raw);
    if (typeof d?.startedAt !== 'number' || now - d.startedAt <= STALE_BLANK_MS) return false;
    const blocks: { sets?: { reps?: string; weight?: string }[] }[] = Array.isArray(d?.form?.blocks)
      ? d.form.blocks
      : [];
    const hasValues = blocks.some((b) => b.sets?.some((s) => (s.reps ?? '') !== '' || (s.weight ?? '') !== ''));
    return !hasValues;
  } catch {
    return false;
  }
}

// Silent clean-up of stale blank drafts. `quiet` skips listener updates, for use during render.
export function pruneStaleNewDraft(quiet = false) {
  const raw = readDraft(NEW_DRAFT_KEY);
  if (raw === null || !isStaleBlankDraft(raw)) return;
  try {
    localStorage.removeItem(NEW_DRAFT_KEY);
  } catch {
    // ignore
  }
  if (!quiet) notify();
}

function draftIsLive(key: string, raw: string | null): boolean {
  if (raw === null) return false;
  return !(key === NEW_DRAFT_KEY && isStaleBlankDraft(raw));
}

export function useHasDraft(key: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => draftIsLive(key, readDraft(key)),
    () => false
  );
}

// When the draft's clock started (epoch ms), or null if there is no live draft or no timestamp.
export function useDraftStart(key: string): number | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      const raw = readDraft(key);
      if (!draftIsLive(key, raw)) return null;
      try {
        const started = JSON.parse(raw as string)?.startedAt;
        return typeof started === 'number' ? started : null;
      } catch {
        return null;
      }
    },
    () => null
  );
}
