import { useSyncExternalStore } from 'react';

import { scheduleRestNotification } from '@/features/workout/rest-notification';

/**
 * Hviletimer for den aktive økten. Starter automatisk når et sett fullføres.
 * Tilstanden ligger i minnet. Et lokalt varsel planlegges slik at man får beskjed også når appen
 * er i bakgrunnen (se rest-notification.ts).
 */
type RestTimerState = { endsAt: number | null; defaultSeconds: number };

let state: RestTimerState = { endsAt: null, defaultSeconds: 90 };
const listeners = new Set<() => void>();

function set(next: RestTimerState) {
  if (next.endsAt !== state.endsAt) scheduleRestNotification(next.endsAt).catch(() => {});
  state = next;
  listeners.forEach((l) => l());
}

export const REST_OPTIONS = [0, 60, 90, 120, 180, 240] as const;

export const restTimer = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Starter med standardvarigheten. 0 betyr at automatisk hviletimer er av. */
  startDefault() {
    if (state.defaultSeconds > 0) set({ ...state, endsAt: Date.now() + state.defaultSeconds * 1000 });
  },
  start(seconds: number) {
    set({ ...state, endsAt: Date.now() + seconds * 1000 });
  },
  adjust(deltaSeconds: number) {
    if (state.endsAt === null) return;
    set({ ...state, endsAt: Math.max(Date.now() + 1000, state.endsAt + deltaSeconds * 1000) });
  },
  stop() {
    set({ ...state, endsAt: null });
  },
  setDefault(seconds: number) {
    set({ ...state, defaultSeconds: seconds });
  },
};

export function useRestTimer() {
  return useSyncExternalStore(restTimer.subscribe, restTimer.getState);
}
