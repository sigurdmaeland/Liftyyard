import type { SQLiteDatabase } from 'expo-sqlite';

import { uuidv7 } from '@/lib/ids';
import { deleteWorkoutPhotoFiles } from '@/storage/photo-store';
import { computeTotals } from '@/lib/metrics';
import type { SetField } from '@/lib/set-fields';
import type { Routine } from '@/types/program';
import type {
  Exercise,
  ExerciseType,
  PreviousSet,
  SetType,
  SyncStatus,
  Workout,
  WorkoutVisibility,
  WorkoutExercise,
  WorkoutSet,
  WorkoutSummary,
} from '@/types/workout';

/*
 * Alle endringer i en aktiv økt skrives til SQLite med en gang. Appen kan derfor
 * lukkes eller miste nett midt i økten uten at noe går tapt.
 */

type WorkoutRow = {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  perceived_effort: number | null;
  source_routine_id: string | null;
  visibility: WorkoutVisibility;
  started_at: string;
  ended_at: string | null;
  status: 'active' | 'finished';
  sync_status: SyncStatus;
  sync_error: string | null;
};

type ExerciseRow = {
  id: string;
  position: number;
  exercise_id: string;
  exercise_name: string;
  exercise_type: string;
  notes: string | null;
  superset_group: number | null;
};

type SetRow = {
  id: string;
  workout_exercise_id: string;
  position: number;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
  completed_at: string | null;
};

const nowIso = () => new Date().toISOString();

function toSet(r: SetRow): WorkoutSet {
  return {
    id: r.id,
    position: r.position,
    setType: r.set_type,
    weightKg: r.weight_kg,
    reps: r.reps,
    durationSeconds: r.duration_seconds,
    distanceM: r.distance_m,
    completedAt: r.completed_at,
  };
}

async function loadWorkout(db: SQLiteDatabase, row: WorkoutRow): Promise<Workout> {
  const exerciseRows = await db.getAllAsync<ExerciseRow>(
    'SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY position',
    row.id,
  );
  const setRows = await db.getAllAsync<SetRow>(
    `SELECT s.* FROM workout_sets s
     JOIN workout_exercises e ON e.id = s.workout_exercise_id
     WHERE e.workout_id = ? ORDER BY s.position`,
    row.id,
  );
  const exercises: WorkoutExercise[] = exerciseRows.map((e) => ({
    id: e.id,
    position: e.position,
    exerciseId: e.exercise_id,
    exerciseName: e.exercise_name,
    exerciseType: e.exercise_type as ExerciseType,
    notes: e.notes,
    supersetGroup: e.superset_group ?? null,
    sets: setRows.filter((s) => s.workout_exercise_id === e.id).map(toSet),
  }));
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    notes: row.notes,
    perceivedEffort: row.perceived_effort,
    sourceRoutineId: row.source_routine_id,
    visibility: row.visibility ?? 'FOLLOWERS',
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status,
    syncStatus: row.sync_status,
    syncError: row.sync_error,
    exercises,
  };
}

async function touch(db: SQLiteDatabase, workoutId: string) {
  await db.runAsync('UPDATE workouts SET updated_at = ? WHERE id = ?', nowIso(), workoutId);
}

// ---------- Aktiv økt ----------

const DEFAULT_VISIBILITY_KEY = 'default_workout_visibility';

/** Standard synlighet for nye økter (Innstillinger → Personvern). Følgere hvis ikke valgt. */
export async function getDefaultVisibility(db: SQLiteDatabase): Promise<WorkoutVisibility> {
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM user_settings WHERE key = ?', DEFAULT_VISIBILITY_KEY);
  return row?.value === 'PUBLIC' || row?.value === 'PRIVATE' ? row.value : 'FOLLOWERS';
}

export async function setDefaultVisibility(db: SQLiteDatabase, visibility: WorkoutVisibility) {
  await db.runAsync(
    `INSERT INTO user_settings (key, value, dirty) VALUES (?, ?, 0) ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    DEFAULT_VISIBILITY_KEY,
    visibility,
  );
}

export async function getActiveWorkout(db: SQLiteDatabase): Promise<Workout | null> {
  const row = await db.getFirstAsync<WorkoutRow>("SELECT * FROM workouts WHERE status = 'active'");
  return row ? loadWorkout(db, row) : null;
}

export async function startWorkout(db: SQLiteDatabase, name: string): Promise<string> {
  const existing = await db.getFirstAsync<{ id: string }>("SELECT id FROM workouts WHERE status = 'active'");
  if (existing) return existing.id;
  const id = uuidv7();
  const now = nowIso();
  await db.runAsync(
    "INSERT INTO workouts (id, name, started_at, status, sync_status, updated_at, visibility) VALUES (?, ?, ?, 'active', 'local', ?, ?)",
    id,
    name,
    now,
    now,
    await getDefaultVisibility(db),
  );
  return id;
}

export async function renameWorkout(db: SQLiteDatabase, workoutId: string, name: string) {
  await db.runAsync('UPDATE workouts SET name = ?, updated_at = ? WHERE id = ?', name, nowIso(), workoutId);
}

export async function setWorkoutNotes(db: SQLiteDatabase, workoutId: string, notes: string) {
  await db.runAsync('UPDATE workouts SET notes = ?, updated_at = ? WHERE id = ?', notes || null, nowIso(), workoutId);
}

/** Legger øvelsen til sist i økten, med ett tomt sett klart til bruk. */
export async function addExerciseToWorkout(db: SQLiteDatabase, workoutId: string, exercise: Exercise) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const pos = await txn.getFirstAsync<{ next: number }>(
      'SELECT COALESCE(MAX(position) + 1, 0) AS next FROM workout_exercises WHERE workout_id = ?',
      workoutId,
    );
    const weId = uuidv7();
    await txn.runAsync(
      `INSERT INTO workout_exercises (id, workout_id, position, exercise_id, exercise_name, exercise_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      weId,
      workoutId,
      pos?.next ?? 0,
      exercise.id,
      exercise.name,
      exercise.exerciseType,
    );
    await txn.runAsync('INSERT INTO workout_sets (id, workout_exercise_id, position) VALUES (?, ?, 0)', uuidv7(), weId);
    await txn.runAsync('UPDATE workouts SET updated_at = ? WHERE id = ?', nowIso(), workoutId);
  });
}

export async function removeWorkoutExercise(db: SQLiteDatabase, workoutId: string, workoutExerciseId: string) {
  await db.runAsync('DELETE FROM workout_exercises WHERE id = ?', workoutExerciseId);
  await touch(db, workoutId);
}

/** Flytter en øvelse ett steg opp (-1) eller ned (+1) ved å bytte posisjon med naboen. */
export async function moveWorkoutExercise(
  db: SQLiteDatabase,
  workoutId: string,
  workoutExerciseId: string,
  direction: -1 | 1,
) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const rows = await txn.getAllAsync<{ id: string; position: number }>(
      'SELECT id, position FROM workout_exercises WHERE workout_id = ? ORDER BY position',
      workoutId,
    );
    const i = rows.findIndex((r) => r.id === workoutExerciseId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= rows.length) return;
    await txn.runAsync('UPDATE workout_exercises SET position = ? WHERE id = ?', rows[j].position, rows[i].id);
    await txn.runAsync('UPDATE workout_exercises SET position = ? WHERE id = ?', rows[i].position, rows[j].id);
    await txn.runAsync('UPDATE workouts SET updated_at = ? WHERE id = ?', nowIso(), workoutId);
  });
}

/**
 * Lager supersett av øvelsen og den neste i økten (eller fjerner øvelsen fra supersettet).
 * Et supersett med bare én øvelse igjen oppløses.
 */
export async function setSuperset(db: SQLiteDatabase, workoutId: string, workoutExerciseId: string, withNext: boolean) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const rows = await txn.getAllAsync<{ id: string; superset_group: number | null }>(
      'SELECT id, superset_group FROM workout_exercises WHERE workout_id = ? ORDER BY position',
      workoutId,
    );
    const i = rows.findIndex((r) => r.id === workoutExerciseId);
    if (i < 0) return;
    if (withNext) {
      const next = rows[i + 1];
      if (!next) return;
      const group = rows[i].superset_group ?? next.superset_group ?? Math.max(0, ...rows.map((r) => r.superset_group ?? 0)) + 1;
      await txn.runAsync('UPDATE workout_exercises SET superset_group = ? WHERE id IN (?, ?)', group, rows[i].id, next.id);
    } else {
      const group = rows[i].superset_group;
      await txn.runAsync('UPDATE workout_exercises SET superset_group = NULL WHERE id = ?', rows[i].id);
      if (group !== null && rows.filter((r) => r.superset_group === group && r.id !== rows[i].id).length === 1) {
        await txn.runAsync('UPDATE workout_exercises SET superset_group = NULL WHERE workout_id = ? AND superset_group = ?', workoutId, group);
      }
    }
    await txn.runAsync('UPDATE workouts SET updated_at = ? WHERE id = ?', nowIso(), workoutId);
  });
}

export async function setExerciseNotes(db: SQLiteDatabase, workoutExerciseId: string, notes: string) {
  await db.runAsync('UPDATE workout_exercises SET notes = ? WHERE id = ?', notes || null, workoutExerciseId);
}

export async function addSet(db: SQLiteDatabase, workoutId: string, workoutExerciseId: string) {
  await db.runAsync(
    `INSERT INTO workout_sets (id, workout_exercise_id, position)
     VALUES (?, ?, (SELECT COALESCE(MAX(position) + 1, 0) FROM workout_sets WHERE workout_exercise_id = ?))`,
    uuidv7(),
    workoutExerciseId,
    workoutExerciseId,
  );
  await touch(db, workoutId);
}

export async function deleteSet(db: SQLiteDatabase, workoutId: string, setId: string) {
  await db.runAsync('DELETE FROM workout_sets WHERE id = ?', setId);
  await touch(db, workoutId);
}

const FIELD_COLUMNS: Record<SetField, string> = {
  weightKg: 'weight_kg',
  reps: 'reps',
  durationSeconds: 'duration_seconds',
  distanceM: 'distance_m',
};

export async function updateSetField(db: SQLiteDatabase, setId: string, field: SetField, value: number | null) {
  // Kolonnenavnet kommer fra en fast tabell, aldri fra brukerinput.
  await db.runAsync(`UPDATE workout_sets SET ${FIELD_COLUMNS[field]} = ? WHERE id = ?`, value, setId);
}

export async function setSetType(db: SQLiteDatabase, setId: string, setType: SetType) {
  await db.runAsync('UPDATE workout_sets SET set_type = ? WHERE id = ?', setType, setId);
}

/** Markerer settet som fullført (med verdiene som skal lagres) eller angrer fullføring. */
export async function setCompleted(
  db: SQLiteDatabase,
  workoutId: string,
  setId: string,
  values: Partial<Record<SetField, number | null>> | null,
) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    if (values) {
      for (const [field, value] of Object.entries(values) as [SetField, number | null][]) {
        await txn.runAsync(`UPDATE workout_sets SET ${FIELD_COLUMNS[field]} = ? WHERE id = ?`, value, setId);
      }
      await txn.runAsync('UPDATE workout_sets SET completed_at = ? WHERE id = ?', nowIso(), setId);
    } else {
      await txn.runAsync('UPDATE workout_sets SET completed_at = NULL WHERE id = ?', setId);
    }
    await txn.runAsync('UPDATE workouts SET updated_at = ? WHERE id = ?', nowIso(), workoutId);
  });
}

export type FinishDetails = {
  name: string;
  description: string | null;
  notes: string | null;
  perceivedEffort: number | null;
  startedAt: string;
  endedAt: string;
  visibility: WorkoutVisibility;
};

/**
 * Fullfører økten med detaljene fra «Fullfør økt»: ufullførte sett og øvelser uten sett fjernes,
 * og økten markeres som klar for opplasting. Returnerer false hvis det ikke finnes fullførte sett.
 */
export async function finishWorkout(db: SQLiteDatabase, workoutId: string, details: FinishDetails): Promise<boolean> {
  let finished = false;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const done = await txn.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM workout_sets s JOIN workout_exercises e ON e.id = s.workout_exercise_id
       WHERE e.workout_id = ? AND s.completed_at IS NOT NULL`,
      workoutId,
    );
    if (!done || done.n === 0) return;
    await txn.runAsync(
      `DELETE FROM workout_sets WHERE completed_at IS NULL
       AND workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)`,
      workoutId,
    );
    await txn.runAsync(
      `DELETE FROM workout_exercises WHERE workout_id = ?
       AND id NOT IN (SELECT DISTINCT workout_exercise_id FROM workout_sets)`,
      workoutId,
    );
    await txn.runAsync(
      `UPDATE workouts SET status = 'finished', sync_status = 'pending', name = ?, description = ?, notes = ?,
       perceived_effort = ?, started_at = ?, ended_at = ?, visibility = ?, updated_at = ? WHERE id = ?`,
      details.name,
      details.description,
      details.notes,
      details.perceivedEffort,
      details.startedAt,
      details.endedAt,
      details.visibility,
      nowIso(),
      workoutId,
    );
    finished = true;
  });
  return finished;
}

/** Endrer hvem som ser en fullført økt. Økten lastes opp på nytt ved neste synk. */
export async function setWorkoutVisibility(db: SQLiteDatabase, workoutId: string, visibility: WorkoutVisibility) {
  await db.runAsync(
    "UPDATE workouts SET visibility = ?, sync_status = 'pending', sync_error = NULL, updated_at = ? WHERE id = ? AND status = 'finished'",
    visibility,
    nowIso(),
    workoutId,
  );
}

export async function discardWorkout(db: SQLiteDatabase, workoutId: string) {
  await db.runAsync("DELETE FROM workouts WHERE id = ? AND status = 'active'", workoutId);
}

// ---------- Historikk ----------

export async function getWorkout(db: SQLiteDatabase, id: string): Promise<Workout | null> {
  const row = await db.getFirstAsync<WorkoutRow>('SELECT * FROM workouts WHERE id = ?', id);
  return row ? loadWorkout(db, row) : null;
}

export async function listFinishedWorkouts(db: SQLiteDatabase, limit = 50): Promise<WorkoutSummary[]> {
  const rows = await db.getAllAsync<WorkoutRow>(
    "SELECT * FROM workouts WHERE status = 'finished' ORDER BY started_at DESC LIMIT ?",
    limit,
  );
  const result: WorkoutSummary[] = [];
  for (const row of rows) {
    const w = await loadWorkout(db, row);
    result.push({
      id: w.id,
      name: w.name,
      startedAt: w.startedAt,
      endedAt: w.endedAt ?? w.startedAt,
      syncStatus: w.syncStatus,
      totals: computeTotals(w.exercises),
    });
  }
  return result;
}

/** Fullførte sett fra siste fullførte økt med denne øvelsen (for «Forrige»-kolonnen). */
export async function getPreviousSets(
  db: SQLiteDatabase,
  exerciseId: string,
  excludeWorkoutId: string,
): Promise<PreviousSet[]> {
  const rows = await db.getAllAsync<SetRow>(
    `SELECT s.* FROM workout_sets s
     WHERE s.completed_at IS NOT NULL AND s.workout_exercise_id = (
       SELECT e.id FROM workout_exercises e JOIN workouts w ON w.id = e.workout_id
       WHERE e.exercise_id = ? AND w.status = 'finished' AND w.id <> ?
       ORDER BY w.started_at DESC, e.position ASC LIMIT 1)
     ORDER BY s.position`,
    exerciseId,
    excludeWorkoutId,
  );
  return rows.map((r) => ({
    setType: r.set_type,
    weightKg: r.weight_kg,
    reps: r.reps,
    durationSeconds: r.duration_seconds,
    distanceM: r.distance_m,
  }));
}

// ---------- Synkronisering ----------

export async function listWorkoutsToSync(db: SQLiteDatabase): Promise<Workout[]> {
  const rows = await db.getAllAsync<WorkoutRow>(
    "SELECT * FROM workouts WHERE status = 'finished' AND sync_status = 'pending' ORDER BY started_at",
  );
  const out: Workout[] = [];
  for (const r of rows) out.push(await loadWorkout(db, r));
  return out;
}

export async function markSyncResult(db: SQLiteDatabase, id: string, status: SyncStatus, error: string | null) {
  await db.runAsync('UPDATE workouts SET sync_status = ?, sync_error = ? WHERE id = ?', status, error, id);
}

export async function countPendingSync(db: SQLiteDatabase): Promise<{ pending: number; failed: number }> {
  const row = await db.getFirstAsync<{ pending: number; failed: number }>(
    `SELECT SUM(sync_status = 'pending') AS pending, SUM(sync_status = 'failed') AS failed
     FROM workouts WHERE status = 'finished'`,
  );
  return { pending: row?.pending ?? 0, failed: row?.failed ?? 0 };
}

/** Lar brukeren prøve en avvist økt på nytt (f.eks. etter en serverfeil som er rettet). */
export async function retryFailed(db: SQLiteDatabase) {
  await db.runAsync("UPDATE workouts SET sync_status = 'pending', sync_error = NULL WHERE sync_status = 'failed'");
}

/**
 * Bytter øvelse i økten (f.eks. når apparatet er opptatt). Settene beholdes. Hvis øvelsestypen
 * er en annen, nullstilles verdiene og fullføringen fordi feltene ikke lenger passer.
 */
export async function replaceWorkoutExercise(
  db: SQLiteDatabase,
  workoutId: string,
  workoutExerciseId: string,
  exercise: Exercise,
) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const current = await txn.getFirstAsync<{ exercise_type: string }>(
      'SELECT exercise_type FROM workout_exercises WHERE id = ?',
      workoutExerciseId,
    );
    await txn.runAsync(
      'UPDATE workout_exercises SET exercise_id = ?, exercise_name = ?, exercise_type = ? WHERE id = ?',
      exercise.id,
      exercise.name,
      exercise.exerciseType,
      workoutExerciseId,
    );
    if (current && current.exercise_type !== exercise.exerciseType) {
      await txn.runAsync(
        `UPDATE workout_sets SET weight_kg = NULL, reps = NULL, duration_seconds = NULL, distance_m = NULL,
         completed_at = NULL WHERE workout_exercise_id = ?`,
        workoutExerciseId,
      );
    }
    await txn.runAsync('UPDATE workouts SET updated_at = ? WHERE id = ?', nowIso(), workoutId);
  });
}

/** Fullførte økter med øvelser og sett, nyeste først (til feeden og statistikk på Hjem). */
export async function listFinishedWorkoutsDetailed(db: SQLiteDatabase, limit = 200): Promise<Workout[]> {
  const rows = await db.getAllAsync<WorkoutRow>(
    "SELECT * FROM workouts WHERE status = 'finished' ORDER BY started_at DESC LIMIT ?",
    limit,
  );
  const out: Workout[] = [];
  for (const r of rows) out.push(await loadWorkout(db, r));
  return out;
}

/** Sletter en fullført økt lokalt og legger slettingen i kø til serveren. */
export async function deleteFinishedWorkout(db: SQLiteDatabase, id: string) {
  await deleteWorkoutPhotoFiles(db, id);
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync("DELETE FROM workouts WHERE id = ? AND status = 'finished'", id);
    await txn.runAsync('INSERT OR IGNORE INTO pending_deletions (workout_id, created_at) VALUES (?, ?)', id, nowIso());
  });
}

export async function listPendingDeletions(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ workout_id: string }>('SELECT workout_id FROM pending_deletions ORDER BY created_at');
  return rows.map((r) => r.workout_id);
}

export async function clearPendingDeletion(db: SQLiteDatabase, id: string) {
  await db.runAsync('DELETE FROM pending_deletions WHERE workout_id = ?', id);
}

/**
 * Starter en økt fra en rutine: rutinen kopieres inn i økten (øyeblikksbilde). Målene fylles inn
 * som verdier i settene, så brukeren bare trykker ✓ når settet er gjort som planlagt. Mangler målvekt,
 * brukes forslaget fra forrige gang. Returnerer null hvis en annen økt allerede pågår.
 */
export async function startWorkoutFromRoutine(db: SQLiteDatabase, routine: Routine): Promise<string | null> {
  const existing = await db.getFirstAsync<{ id: string }>("SELECT id FROM workouts WHERE status = 'active'");
  if (existing) return null;
  const id = uuidv7();
  const now = nowIso();
  const visibility = await getDefaultVisibility(db);
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO workouts (id, name, started_at, status, sync_status, updated_at, source_routine_id, visibility)
       VALUES (?, ?, ?, 'active', 'local', ?, ?, ?)`,
      id,
      routine.name,
      now,
      now,
      routine.id,
      visibility,
    );
    for (const [i, e] of routine.exercises.entries()) {
      const weId = uuidv7();
      await txn.runAsync(
        `INSERT INTO workout_exercises (id, workout_id, position, exercise_id, exercise_name, exercise_type, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        weId,
        id,
        i,
        e.exerciseId,
        e.exerciseName,
        e.exerciseType,
        e.notes,
      );
      const sets = e.sets.length > 0 ? e.sets : [null];
      for (const [j, s] of sets.entries()) {
        await txn.runAsync(
          `INSERT INTO workout_sets (id, workout_exercise_id, position, set_type, weight_kg, reps, duration_seconds)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          uuidv7(),
          weId,
          j,
          s?.setType ?? 'NORMAL',
          s?.targetWeightKg ?? null,
          s?.targetReps ?? null,
          s?.targetDurationSeconds ?? null,
        );
      }
    }
  });
  return id;
}

export type ExerciseHistoryEntry = {
  workoutId: string;
  workoutName: string;
  startedAt: string;
  sets: WorkoutSet[];
};

/** Alle fullførte økter med øvelsen, nyeste først, med fullførte sett. */
export async function getExerciseHistory(db: SQLiteDatabase, exerciseId: string): Promise<ExerciseHistoryEntry[]> {
  const rows = await db.getAllAsync<SetRow & { workout_id: string; workout_name: string; started_at: string }>(
    `SELECT s.*, w.id AS workout_id, w.name AS workout_name, w.started_at
     FROM workout_sets s
     JOIN workout_exercises e ON e.id = s.workout_exercise_id
     JOIN workouts w ON w.id = e.workout_id
     WHERE e.exercise_id = ? AND w.status = 'finished' AND s.completed_at IS NOT NULL
     ORDER BY w.started_at DESC, e.position, s.position`,
    exerciseId,
  );
  const byWorkout = new Map<string, ExerciseHistoryEntry>();
  for (const r of rows) {
    let entry = byWorkout.get(r.workout_id);
    if (!entry) {
      entry = { workoutId: r.workout_id, workoutName: r.workout_name, startedAt: r.started_at, sets: [] };
      byWorkout.set(r.workout_id, entry);
    }
    entry.sets.push(toSet(r));
  }
  return [...byWorkout.values()];
}
