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

export function useHasDraft(key: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => readDraft(key) !== null,
    () => false
  );
}
