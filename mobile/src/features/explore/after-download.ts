import type { SQLiteDatabase } from 'expo-sqlite';

import { refreshCatalogCache } from '@/hooks/use-catalog';
import { refreshExerciseCatalog } from '@/services/sync';

/**
 * Etter en nedlasting kan serveren ha laget kopier av forfatterens egne øvelser til brukeren.
 * Henter katalogen på nytt så rutinene viser riktige øvelser (muskler, ikoner) med en gang.
 */
export async function refreshAfterDownload(db: SQLiteDatabase) {
  if (await refreshExerciseCatalog(db)) await refreshCatalogCache(db);
}
