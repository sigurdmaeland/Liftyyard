import { File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { uuidv7 } from '@/lib/ids';

/*
 * Bilder på økter (maks 4). Et nytt bilde kopieres til appens dokumentmappe og lastes opp når
 * økten er synket. Etter opplasting brukes adressen på serveren, og den lokale filen slettes.
 */

export const MAX_WORKOUT_PHOTOS = 4;

type Row = {
  id: string;
  workout_id: string;
  position: number;
  file: string | null;
  remote_url: string | null;
  sync_status: string;
  upload_error: string | null;
};

/** uploading: venter på opplasting. error: serveren avviste bildet (vises med «Prøv igjen»). */
export type WorkoutPhoto = { id: string; uri: string; uploading: boolean; error: string | null };

const nowIso = () => new Date().toISOString();

function localUri(file: string | null): string | null {
  if (!file) return null;
  const f = new File(Paths.document, file);
  return f.exists ? f.uri : null;
}

function deleteFile(file: string | null) {
  if (!file) return;
  const f = new File(Paths.document, file);
  if (f.exists) f.delete();
}

export async function listWorkoutPhotos(db: SQLiteDatabase, workoutId: string): Promise<WorkoutPhoto[]> {
  const rows = await db.getAllAsync<Row>(
    "SELECT * FROM workout_photos WHERE workout_id = ? AND sync_status <> 'deleted' ORDER BY position, created_at",
    workoutId,
  );
  return rows.flatMap((r) => {
    const uri = localUri(r.file) ?? r.remote_url;
    return uri ? [{ id: r.id, uri, uploading: r.sync_status === 'pending' && !r.upload_error, error: r.upload_error }] : [];
  });
}

/** Legger til et bilde på en økt. Returnerer false hvis økten allerede har 4 bilder. */
export async function addWorkoutPhoto(db: SQLiteDatabase, workoutId: string, sourceUri: string): Promise<boolean> {
  const count = await db.getFirstAsync<{ n: number; max: number | null }>(
    "SELECT count(*) AS n, max(position) AS max FROM workout_photos WHERE workout_id = ? AND sync_status <> 'deleted'",
    workoutId,
  );
  if ((count?.n ?? 0) >= MAX_WORKOUT_PHOTOS) return false;
  const id = uuidv7();
  const file = `photo-${id}.jpg`;
  new File(sourceUri).copy(new File(Paths.document, file));
  await db.runAsync(
    `INSERT INTO workout_photos (id, workout_id, position, file, sync_status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`,
    id,
    workoutId,
    (count?.max ?? -1) + 1,
    file,
    nowIso(),
  );
  return true;
}

/** Fjerner et bilde. Er det lastet opp, slettes det på serveren ved neste synk. */
export async function removeWorkoutPhoto(db: SQLiteDatabase, photoId: string) {
  const row = await db.getFirstAsync<Row>('SELECT * FROM workout_photos WHERE id = ?', photoId);
  if (!row) return;
  deleteFile(row.file);
  if (row.sync_status === 'synced') {
    await db.runAsync("UPDATE workout_photos SET sync_status = 'deleted', file = NULL WHERE id = ?", photoId);
  } else {
    await db.runAsync('DELETE FROM workout_photos WHERE id = ?', photoId);
  }
}

/** Sletter lokale bildefiler til en økt (før økten slettes). */
export async function deleteWorkoutPhotoFiles(db: SQLiteDatabase, workoutId: string) {
  const rows = await db.getAllAsync<Row>('SELECT * FROM workout_photos WHERE workout_id = ?', workoutId);
  rows.forEach((r) => deleteFile(r.file));
}

// ---------- Synk ----------

/** Bilder som venter på opplasting, for økter som allerede finnes på serveren. */
export async function listPhotosToUpload(db: SQLiteDatabase): Promise<{ id: string; workoutId: string; uri: string }[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT p.* FROM workout_photos p JOIN workouts w ON w.id = p.workout_id
     WHERE p.sync_status = 'pending' AND p.upload_error IS NULL AND w.sync_status = 'synced' ORDER BY p.created_at`,
  );
  return rows.flatMap((r) => {
    const uri = localUri(r.file);
    return uri ? [{ id: r.id, workoutId: r.workout_id, uri }] : [];
  });
}

export async function markPhotoUploaded(db: SQLiteDatabase, photoId: string, url: string) {
  const row = await db.getFirstAsync<Row>('SELECT * FROM workout_photos WHERE id = ?', photoId);
  if (!row || row.sync_status !== 'pending') return;
  await db.runAsync("UPDATE workout_photos SET sync_status = 'synced', remote_url = ?, file = NULL WHERE id = ?", url, photoId);
  deleteFile(row.file);
}

/** Serveren avviste bildet. Det beholdes lokalt med feilmeldingen til brukeren prøver igjen eller fjerner det. */
export async function markPhotoFailed(db: SQLiteDatabase, photoId: string, error: string) {
  await db.runAsync('UPDATE workout_photos SET upload_error = ? WHERE id = ?', error, photoId);
}

/** Nytt forsøk på et bilde som ble avvist. */
export async function retryPhoto(db: SQLiteDatabase, photoId: string) {
  await db.runAsync('UPDATE workout_photos SET upload_error = NULL WHERE id = ?', photoId);
}

/** Lokale bilder for økter, til feeden (egne økter før bildene er lastet opp). */
export async function listLocalPhotoUris(db: SQLiteDatabase): Promise<Map<string, string[]>> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM workout_photos WHERE sync_status <> 'deleted' ORDER BY position, created_at");
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const uri = localUri(r.file) ?? r.remote_url;
    if (uri) map.set(r.workout_id, [...(map.get(r.workout_id) ?? []), uri]);
  }
  return map;
}

export async function listPhotoDeletions(db: SQLiteDatabase): Promise<{ id: string; workoutId: string }[]> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM workout_photos WHERE sync_status = 'deleted'");
  return rows.map((r) => ({ id: r.id, workoutId: r.workout_id }));
}

export async function clearPhotoDeletion(db: SQLiteDatabase, photoId: string) {
  await db.runAsync('DELETE FROM workout_photos WHERE id = ?', photoId);
}
