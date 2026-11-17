// Calls into the iOS app's native code (ios/App/App/GymTimerPlugin.swift). On the website, and in
// an app build too old to have the plugin, every call quietly does nothing, so callers never
// need to check where they are running.

import { Capacitor, registerPlugin } from '@capacitor/core';

interface GymTimerPlugin {
  start(options: { startedAt: number }): Promise<void>;
  update(options: { restEndsAt: number | null; restSeconds: number | null }): Promise<void>;
  end(): Promise<void>;
}

const GymTimer = registerPlugin<GymTimerPlugin>('GymTimer');

function available(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('GymTimer');
}

function call(fn: () => Promise<void>) {
  if (!available()) return;
  fn().catch((e) => console.warn('[native]', e));
}

// The lock-screen Live Activity, plus the end-of-rest notification on a locked phone.
export const liveActivity = {
  /** A new session is open. Safe to call again with the same time. */
  start(startedAt: number) {
    call(() => GymTimer.start({ startedAt }));
  },
  /** A rest is counting down to `endAt` (ms), or is over when null. */
  rest(endAt: number | null, seconds: number | null = null) {
    call(() => GymTimer.update({ restEndsAt: endAt, restSeconds: endAt === null ? null : seconds }));
  },
  /** The session was saved or thrown away. */
  end() {
    call(() => GymTimer.end());
  },
};
