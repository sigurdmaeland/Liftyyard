import type { SQLiteDatabase } from 'expo-sqlite';

import type { Measurement } from '@/types/measurement';
import type { SetType } from '@/types/workout';

/*
 * Data på telefonen sett fra kontoens side: hvem som eier dem, om noe ikke er synket,
 * sletting ved utlogging og innlegging av data hentet fra serveren ved innlogging.
 */

const OWNER_KEY = 'account_user_id';

/** Tabeller med brukerdata, i en rekkefølge som tåler fremmednøkler ved sletting. */
const USER_TABLES = [
  'workout_photos',
  'workout_sets',
  'workout_exercises',
  'workouts',
  'pending_deletions',
  'routine_sets',
  'routine_exercises',
  'routines',
  'programs',
  'pending_program_deletions',
  'pending_routine_deletions',
  'body_measurements',
  'pending_measurement_deletions',
  'user_settings',
  // Katalogen (med egne øvelser og favoritter) hentes på nytt ved neste innlogging.
  'exercises',
];

export async function getDataOwner(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM user_settings WHERE key = ?', OWNER_KEY);
  return row?.value ?? null;
}

export async function setDataOwner(db: SQLiteDatabase, userId: string) {
  await db.runAsync(
    `INSERT INTO user_settings (key, value, dirty) VALUES (?, ?, 0) ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    OWNER_KEY,
    userId,
  );
}

/** Finnes det treningsdata på telefonen (økter, programmer, rutiner eller målinger)? */
export async function hasLocalUserData(db: SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT (SELECT count(*) FROM workouts) + (SELECT count(*) FROM programs) + (SELECT count(*) FROM routines)
          + (SELECT count(*) FROM body_measurements) AS n`,
  );
  return (row?.n ?? 0) > 0;
}

/** Antall endringer som ikke er sendt til serveren ennå (brukes før utlogging). */
export async function countUnsynced(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT
       (SELECT count(*) FROM workouts WHERE status = 'finished' AND sync_status IN ('pending', 'failed'))
     + (SELECT count(*) FROM workouts WHERE status = 'active')
     + (SELECT count(*) FROM pending_deletions)
     + (SELECT count(*) FROM programs WHERE sync_status <> 'synced')
     + (SELECT count(*) FROM routines WHERE sync_status <> 'synced' OR favorite_dirty = 1)
     + (SELECT count(*) FROM pending_program_deletions) + (SELECT count(*) FROM pending_routine_deletions)
     + (SELECT count(*) FROM exercises WHERE sync_status <> 'synced' OR favorite_dirty = 1)
     + (SELECT count(*) FROM body_measurements WHERE sync_status <> 'synced')
     + (SELECT count(*) FROM pending_measurement_deletions)
     + (SELECT count(*) FROM user_settings WHERE dirty = 1) AS n`,
  );
  return row?.n ?? 0;
}

/** Sletter alle brukerdata fra telefonen. */
export async function wipeLocalData(db: SQLiteDatabase) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const table of USER_TABLES) await txn.runAsync(`DELETE FROM ${table}`);
  });
}

// ---------- Innlegging av data fra serveren ----------

export type RemoteWorkout = {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  perceivedEffort: number | null;
  sourceRoutineId: string | null;
  visibility: string | null;
  startedAt: string;
  endedAt: string;
  updatedAt: string;
  exercises: {
    id: string;
    exerciseId: string;
    exerciseName: string;
    exerciseType: string;
    notes: string | null;
    supersetGroup?: number | null;
    sets: {
      id: string;
      setType: SetType;
      weightKg: number | null;
      reps: number | null;
      rpe: number | null;
      durationSeconds: number | null;
      distanceM: number | null;
      completedAt: string | null;
    }[];
  }[];
};

export async function insertRemoteWorkout(db: SQLiteDatabase, w: RemoteWorkout) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT OR REPLACE INTO workouts (id, name, description, notes, perceived_effort, source_routine_id, started_at, ended_at,
         status, sync_status, updated_at, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'finished', 'synced', ?, ?)`,
      w.id, w.name, w.description, w.notes, w.perceivedEffort, w.sourceRoutineId, w.startedAt, w.endedAt, w.updatedAt,
      w.visibility ?? 'FOLLOWERS',
    );
    for (const [i, e] of w.exercises.entries()) {
      await txn.runAsync(
        `INSERT OR REPLACE INTO workout_exercises (id, workout_id, position, exercise_id, exercise_name, exercise_type, notes, superset_group)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        e.id, w.id, i, e.exerciseId, e.exerciseName, e.exerciseType, e.notes, e.supersetGroup ?? null,
      );
      for (const [j, s] of e.sets.entries()) {
        await txn.runAsync(
          `INSERT OR REPLACE INTO workout_sets (id, workout_exercise_id, position, set_type, weight_kg, reps, rpe,
             duration_seconds, distance_m, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          s.id, e.id, j, s.setType, s.weightKg, s.reps, s.rpe, s.durationSeconds, s.distanceM, s.completedAt,
        );
      }
    }
  });
}

export type RemoteRoutine = {
  id: string;
  programId: string | null;
  position: number;
  name: string;
  notes: string | null;
  favorite: boolean;
  visibility?: string;
  sourceRoutineId?: string | null;
  basedOn?: unknown;
  createdAt: string;
  updatedAt: string;
  exercises: {
    id: string;
    exerciseId: string;
    exerciseName: string;
    exerciseType: string;
    notes: string | null;
    restSeconds: number | null;
    sets: { id: string; setType: SetType; targetReps: number | null; targetWeightKg: number | null; targetDurationSeconds: number | null }[];
  }[];
};

export type RemoteProgramMeta = {
  id: string;
  name: string;
  description: string | null;
  visibility?: string;
  level?: string | null;
  daysPerWeek?: number | null;
  basedOn?: unknown;
  sourceProgramId: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function insertRemoteProgram(db: SQLiteDatabase, p: RemoteProgramMeta) {
  await db.runAsync(
    `INSERT OR REPLACE INTO programs (id, name, description, visibility, level, days_per_week, credit, created_at, updated_at, sync_status,
       source_program_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
    p.id, p.name, p.description, p.visibility ?? 'PRIVATE', p.level ?? null, p.daysPerWeek ?? null, p.basedOn ? JSON.stringify(p.basedOn) : null,
    p.createdAt, p.updatedAt, p.sourceProgramId,
  );
}

export async function insertRemoteRoutine(db: SQLiteDatabase, r: RemoteRoutine) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT OR REPLACE INTO routines (id, program_id, position, name, notes, visibility, source_routine_id, credit, created_at, updated_at,
         sync_status, is_favorite, favorite_dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, 0)`,
      r.id, r.programId, r.position, r.name, r.notes, r.visibility ?? 'PRIVATE', r.sourceRoutineId ?? null,
      r.basedOn ? JSON.stringify(r.basedOn) : null, r.createdAt, r.updatedAt,
      r.favorite ? 1 : 0,
    );
    for (const [i, e] of r.exercises.entries()) {
      await txn.runAsync(
        `INSERT OR REPLACE INTO routine_exercises (id, routine_id, position, exercise_id, exercise_name, exercise_type, notes, rest_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        e.id, r.id, i, e.exerciseId, e.exerciseName, e.exerciseType, e.notes, e.restSeconds,
      );
      for (const [j, s] of e.sets.entries()) {
        await txn.runAsync(
          `INSERT OR REPLACE INTO routine_sets (id, routine_exercise_id, position, set_type, target_reps, target_weight_kg, target_duration_seconds)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          s.id, e.id, j, s.setType, s.targetReps, s.targetWeightKg, s.targetDurationSeconds,
        );
      }
    }
  });
}

export async function insertRemoteMeasurements(db: SQLiteDatabase, items: Measurement[]) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const m of items) {
      await txn.runAsync(
        `INSERT OR REPLACE INTO body_measurements (id, kind, value, measured_at, updated_at, sync_status)
         VALUES (?, ?, ?, ?, ?, 'synced')`,
        m.id, m.kind, m.value, m.measuredAt, m.measuredAt,
      );
    }
  });
}
