import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback } from 'react';

import { useLocalQuery } from '@/hooks/use-local-query';
import { type SetRecord, bestMedals, setRecordsByWorkout } from '@/lib/records';
import { listFinishedWorkoutsDetailed } from '@/storage/workout-store';

const EMPTY = new Map<string, SetRecord[]>();

/**
 * Rekorder for en av brukerens egne økter, regnet ut fra historikken på telefonen.
 * `enabled = false` (andres økter) gir ingen rekorder.
 */
export function useWorkoutRecords(workoutId: string, enabled = true) {
  const query = useCallback(
    async (db: SQLiteDatabase) => (enabled ? (setRecordsByWorkout(await listFinishedWorkoutsDetailed(db)).get(workoutId) ?? EMPTY) : EMPTY),
    [workoutId, enabled],
  );
  const { state, reload } = useLocalQuery(query);
  const bySet = state.status === 'ready' ? state.data : EMPTY;
  const lists = [...bySet.values()];
  return {
    bySet,
    summary: { count: lists.reduce((n, l) => n + l.length, 0), medals: bestMedals(lists) },
    reload,
  };
}
