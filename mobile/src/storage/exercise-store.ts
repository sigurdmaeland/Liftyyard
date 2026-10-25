import type { SQLiteDatabase } from 'expo-sqlite';

import { uuidv7 } from '@/lib/ids';
import type { Exercise, ExerciseType } from '@/types/workout';

type ExerciseRow = {
  id: string;
  name: string;
  exercise_type: string;
  equipment: string;
  primary_muscles: string;
  secondary_muscles: string;
  instructions: string | null;
  custom: number;
  is_favorite: number;
  favorite_dirty: number;
  sync_status: 'synced' | 'pending' | 'failed';
  deleted: number;
  updated_at: string | null;
};

function toExercise(r: ExerciseRow): Exercise {
  return {
    id: r.id,
    name: r.name,
    exerciseType: r.exercise_type as ExerciseType,
    equipment: r.equipment,
    primaryMuscles: JSON.parse(r.primary_muscles) as string[],
    secondaryMuscles: JSON.parse(r.secondary_muscles) as string[],
    instructions: r.instructions,
    custom: r.custom === 1,
    favorite: r.is_favorite === 1,
  };
}

/**
 * Oppdaterer den lokale kopien av katalogen med det serveren sendte. Lokale endringer som ikke er
 * synket ennå (nye/endrede egne øvelser, favoritter, slettinger) beholdes og vinner.
 */
export async function replaceCatalog(db: SQLiteDatabase, exercises: Exercise[]): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const local = await txn.getAllAsync<ExerciseRow>(
      "SELECT * FROM exercises WHERE sync_status <> 'synced' OR favorite_dirty = 1 OR deleted = 1",
    );
    await txn.runAsync('DELETE FROM exercises');
    for (const e of exercises) {
      await txn.runAsync(
        `INSERT INTO exercises (id, name, exercise_type, equipment, primary_muscles, secondary_muscles, instructions,
           custom, is_favorite, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        e.id,
        e.name,
        e.exerciseType,
        e.equipment,
        JSON.stringify(e.primaryMuscles),
        JSON.stringify(e.secondaryMuscles),
        e.instructions ?? null,
        e.custom ? 1 : 0,
        e.favorite ? 1 : 0,
      );
    }
    for (const r of local) {
      await txn.runAsync(
        `INSERT OR REPLACE INTO exercises (id, name, exercise_type, equipment, primary_muscles, secondary_muscles,
           instructions, custom, is_favorite, favorite_dirty, sync_status, deleted, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        r.id, r.name, r.exercise_type, r.equipment, r.primary_muscles, r.secondary_muscles, r.instructions,
        r.custom, r.is_favorite, r.favorite_dirty, r.sync_status, r.deleted, r.updated_at,
      );
    }
  });
}

export async function listExercises(db: SQLiteDatabase): Promise<Exercise[]> {
  const rows = await db.getAllAsync<ExerciseRow>('SELECT * FROM exercises WHERE deleted = 0 ORDER BY name COLLATE NOCASE');
  return rows.map(toExercise);
}

export async function listFavoriteExercises(db: SQLiteDatabase): Promise<Exercise[]> {
  const rows = await db.getAllAsync<ExerciseRow>(
    'SELECT * FROM exercises WHERE deleted = 0 AND is_favorite = 1 ORDER BY name COLLATE NOCASE',
  );
  return rows.map(toExercise);
}

export async function listCustomExercises(db: SQLiteDatabase): Promise<Exercise[]> {
  const rows = await db.getAllAsync<ExerciseRow>(
    'SELECT * FROM exercises WHERE deleted = 0 AND custom = 1 ORDER BY name COLLATE NOCASE',
  );
  return rows.map(toExercise);
}

export async function getExercise(db: SQLiteDatabase, id: string): Promise<Exercise | null> {
  const row = await db.getFirstAsync<ExerciseRow>('SELECT * FROM exercises WHERE id = ?', id);
  return row ? toExercise(row) : null;
}

export async function setExerciseFavorite(db: SQLiteDatabase, id: string, favorite: boolean) {
  await db.runAsync('UPDATE exercises SET is_favorite = ?, favorite_dirty = 1 WHERE id = ?', favorite ? 1 : 0, id);
}

export type CustomExerciseInput = {
  name: string;
  exerciseType: ExerciseType;
  equipment: string;
  instructions: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
};

/** Oppretter (uten id) eller oppdaterer en egendefinert øvelse. Lastes opp ved neste synk. */
export async function saveCustomExercise(db: SQLiteDatabase, input: CustomExerciseInput, id?: string): Promise<string> {
  const exerciseId = id ?? uuidv7();
  await db.runAsync(
    `INSERT INTO exercises (id, name, exercise_type, equipment, primary_muscles, secondary_muscles, instructions,
       custom, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, exercise_type = excluded.exercise_type,
       equipment = excluded.equipment, primary_muscles = excluded.primary_muscles,
       secondary_muscles = excluded.secondary_muscles, instructions = excluded.instructions,
       sync_status = 'pending', updated_at = excluded.updated_at`,
    exerciseId,
    input.name,
    input.exerciseType,
    input.equipment,
    JSON.stringify(input.primaryMuscles),
    JSON.stringify(input.secondaryMuscles),
    input.instructions,
    new Date().toISOString(),
  );
  return exerciseId;
}

/** Skjuler øvelsen lokalt; serveren arkiverer den ved neste synk. Historikk beholder navnet. */
export async function deleteCustomExercise(db: SQLiteDatabase, id: string) {
  await db.runAsync("UPDATE exercises SET deleted = 1, sync_status = 'pending' WHERE id = ? AND custom = 1", id);
}

/** Filtrerer i minnet (katalogen er liten). Treffer navn og muskelgrupper. */
export function filterExercises(exercises: Exercise[], query: string, muscle: string | null): Exercise[] {
  const q = query.trim().toLowerCase();
  return exercises.filter(
    (e) =>
      (q === '' || e.name.toLowerCase().includes(q)) &&
      (muscle === null || e.primaryMuscles.includes(muscle) || e.secondaryMuscles.includes(muscle)),
  );
}

// ---------- Synk ----------

export async function listCustomExercisesToSync(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<ExerciseRow>("SELECT * FROM exercises WHERE custom = 1 AND sync_status = 'pending'");
  return rows.map((r) => ({ exercise: toExercise(r), deleted: r.deleted === 1, version: r.updated_at }));
}

export async function markExerciseSynced(db: SQLiteDatabase, id: string, deleted: boolean, version: string | null) {
  if (deleted) await db.runAsync('DELETE FROM exercises WHERE id = ? AND deleted = 1', id);
  else await db.runAsync("UPDATE exercises SET sync_status = 'synced' WHERE id = ? AND updated_at IS ?", id, version);
}

export async function markExerciseFailed(db: SQLiteDatabase, id: string) {
  await db.runAsync("UPDATE exercises SET sync_status = 'failed' WHERE id = ?", id);
}

export async function listDirtyExerciseFavorites(db: SQLiteDatabase): Promise<{ id: string; favorite: boolean }[]> {
  const rows = await db.getAllAsync<{ id: string; is_favorite: number }>(
    'SELECT id, is_favorite FROM exercises WHERE favorite_dirty = 1 AND deleted = 0',
  );
  return rows.map((r) => ({ id: r.id, favorite: r.is_favorite === 1 }));
}

export async function clearExerciseFavoriteDirty(db: SQLiteDatabase, id: string, favorite: boolean) {
  await db.runAsync('UPDATE exercises SET favorite_dirty = 0 WHERE id = ? AND is_favorite = ?', id, favorite ? 1 : 0);
}
