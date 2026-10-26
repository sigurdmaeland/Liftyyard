import type { SQLiteDatabase } from 'expo-sqlite';

import type { ExportRow } from '@/lib/export';
import { SET_TYPE_NAMES, type SetType } from '@/types/workout';

/** Alle fullførte sett i fullførte økter, eldste først (til CSV-eksport). */
export async function listExportRows(db: SQLiteDatabase): Promise<ExportRow[]> {
  const rows = await db.getAllAsync<{
    exercise_row: string;
    started_at: string;
    workout: string;
    exercise: string;
    set_position: number;
    set_type: SetType;
    weight_kg: number | null;
    reps: number | null;
    duration_seconds: number | null;
    distance_m: number | null;
    rpe: number | null;
    notes: string | null;
  }>(
    `SELECT e.id AS exercise_row, w.started_at, w.name AS workout, e.exercise_name AS exercise, s.position AS set_position, s.set_type,
            s.weight_kg, s.reps, s.duration_seconds, s.distance_m, s.rpe, e.notes
     FROM workouts w
     JOIN workout_exercises e ON e.workout_id = w.id
     JOIN workout_sets s ON s.workout_exercise_id = e.id
     WHERE w.status = 'finished' AND s.completed_at IS NOT NULL
     ORDER BY w.started_at, e.position, s.position`,
  );
  // Settnummer telles per øvelse i økten (posisjonen kan ha hull etter slettede sett).
  let key = '';
  let n = 0;
  return rows.map((r) => {
    const k = r.exercise_row;
    n = k === key ? n + 1 : 1;
    key = k;
    const sentence = SET_TYPE_NAMES[r.set_type] ?? r.set_type;
    return {
      date: r.started_at.slice(0, 10),
      workout: r.workout,
      exercise: r.exercise,
      setNumber: n,
      setType: sentence.charAt(0).toUpperCase() + sentence.slice(1),
      weightKg: r.weight_kg,
      reps: r.reps,
      durationSeconds: r.duration_seconds,
      distanceM: r.distance_m,
      rpe: r.rpe,
      notes: n === 1 ? r.notes : null,
    };
  });
}
