import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useSyncExternalStore } from 'react';

import { getProfile } from '@/storage/profile-store';
import { EMPTY_PROFILE, type Profile } from '@/types/profile';

/*
 * Felles tilstand for brukerens profil, slik at alle avatarer i appen viser samme bilde og
 * oppdateres med en gang profilen endres (refreshProfile kalles etter lagring).
 */
let current: Profile = { ...EMPTY_PROFILE, username: null, displayName: null, photoUri: null, role: 'USER', mustAcceptTerms: false };
let loaded = false;
const listeners = new Set<() => void>();

export async function refreshProfile(db: SQLiteDatabase) {
  current = await getProfile(db);
  loaded = true;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProfile(): Profile {
  return useProfileState().profile;
}

/** Profilen og om den er lest fra databasen ennå (for å vite om velkomstflyten trengs). */
export function useProfileState(): { profile: Profile; loaded: boolean } {
  const db = useSQLiteContext();
  useEffect(() => {
    if (!loaded) refreshProfile(db).catch(() => {});
  }, [db]);
  const snapshot = useSyncExternalStore(subscribe, () => current);
  return { profile: snapshot, loaded: useSyncExternalStore(subscribe, () => loaded) };
}
