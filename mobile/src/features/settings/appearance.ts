import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

/**
 * Utseende: følg telefonen (standard), alltid lyst eller alltid mørkt.
 * Valget gjelder denne telefonen, lagres utenfor kontodatabasen og overlever derfor utlogging.
 * Appearance.setColorScheme gjør at useColorScheme(), navigasjonen og systemflater (tastatur,
 * varsler, statuslinje) følger valget.
 */
export type AppearancePref = 'system' | 'light' | 'dark';

const KEY = 'appearance';
const listeners = new Set<() => void>();
let current: AppearancePref = 'system';

function read(): AppearancePref {
  try {
    const v = Storage.getItemSync(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(pref: AppearancePref) {
  Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
}

/** Kalles én gang ved oppstart, før første skjerm tegnes, så appen ikke blinker i feil modus. */
export function initAppearance() {
  current = read();
  apply(current);
}

export function setAppearance(pref: AppearancePref) {
  current = pref;
  apply(pref);
  try {
    Storage.setItemSync(KEY, pref);
  } catch {
    // Lagring er ikke kritisk: valget gjelder uansett resten av økten.
  }
  listeners.forEach((l) => l());
}

export function useAppearancePref(): AppearancePref {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export const APPEARANCE_OPTIONS: { value: AppearancePref; label: string; icon: SFSymbol; fallback: string }[] = [
  { value: 'system', label: 'Automatisk', icon: 'circle.lefthalf.filled', fallback: '◐' },
  { value: 'light', label: 'Lys', icon: 'sun.max', fallback: '☀' },
  { value: 'dark', label: 'Mørk', icon: 'moon', fallback: '☾' },
];
