import type { SQLiteDatabase } from 'expo-sqlite';

import { type RecordKind, estimateOneRepMax } from '@/lib/records';

/**
 * Sjekker om et nettopp fullført sett er ny personlig rekord for øvelsen (estimert 1RM, vekt
 * eller settvolum), sammenlignet med alle tidligere fullførte sett – også tidligere sett i
 * samme økt. Første gang en øvelse logges gir ingen rekord (samme regel som medaljene).
 */
export async function newRecordsForSet(db: SQLiteDatabase, setId: string, weightKg: number | null, reps: number | null): Promise<RecordKind[]> {
  const e1rm = estimateOneRepMax(weightKg, reps);
  if (e1rm === null) return [];
  const exercise = await db.getFirstAsync<{ exercise_id: string; workout_id: string }>(
    `SELECT e.exercise_id, e.workout_id FROM workout_sets s JOIN workout_exercises e ON e.id = s.workout_exercise_id WHERE s.id = ?`,
    setId,
  );
  if (!exercise) return [];
  const rows = await db.getAllAsync<{ weight_kg: number; reps: number; workout_id: string; status: string }>(
    `SELECT s.weight_kg, s.reps, w.id AS workout_id, w.status
     FROM workout_sets s
     JOIN workout_exercises e ON e.id = s.workout_exercise_id
     JOIN workouts w ON w.id = e.workout_id
     WHERE e.exercise_id = ? AND s.id <> ? AND s.completed_at IS NOT NULL AND s.set_type <> 'WARMUP'
       AND s.weight_kg > 0 AND s.reps > 0`,
    exercise.exercise_id,
    setId,
  );
  // Rekord krever at øvelsen er logget i en tidligere økt.
  if (!rows.some((r) => r.workout_id !== exercise.workout_id)) return [];
  let best = { E1RM: 0, WEIGHT: 0, VOLUME: 0 };
  for (const r of rows) {
    best = {
      E1RM: Math.max(best.E1RM, estimateOneRepMax(r.weight_kg, r.reps) ?? 0),
      WEIGHT: Math.max(best.WEIGHT, r.weight_kg),
      VOLUME: Math.max(best.VOLUME, r.weight_kg * r.reps),
    };
  }
  const now = { E1RM: e1rm, WEIGHT: weightKg!, VOLUME: weightKg! * reps! };
  return (['E1RM', 'WEIGHT', 'VOLUME'] as RecordKind[]).filter((k) => now[k] > best[k] + 1e-9);
}
