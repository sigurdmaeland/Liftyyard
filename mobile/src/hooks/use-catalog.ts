import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useSyncExternalStore } from 'react';

import { listExercises } from '@/storage/exercise-store';
import type { Exercise } from '@/types/workout';

/*
 * Øvelseskatalogen som oppslag (id → øvelse), delt av alle kort som viser muskelfigurer.
 * Lastes én gang og oppdateres når refreshCatalogCache kalles (f.eks. etter synk av katalogen).
 */
let catalog = new Map<string, Exercise>();
let loading = false;
const listeners = new Set<() => void>();

export async function refreshCatalogCache(db: Parameters<typeof listExercises>[0]) {
  catalog = new Map((await listExercises(db)).map((e) => [e.id, e]));
  listeners.forEach((l) => l());
}

export function useCatalog(): Map<string, Exercise> {
  const db = useSQLiteContext();
  useEffect(() => {
    if (catalog.size === 0 && !loading) {
      loading = true;
      refreshCatalogCache(db)
        .catch(() => {})
        .finally(() => {
          loading = false;
        });
    }
  }, [db]);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => catalog,
  );
}
