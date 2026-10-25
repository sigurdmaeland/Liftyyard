import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { ExerciseLibrary } from '@/features/exercises/exercise-library';
import { addExerciseToRoutine } from '@/storage/program-store';
import type { Exercise } from '@/types/workout';

/** Velg øvelse til en rutine. Øvelsen får 3 målsett som kan justeres. */
export default function AddRoutineExerciseScreen() {
  const db = useSQLiteContext();
  const { routineId } = useLocalSearchParams<{ routineId: string }>();
  const [busy, setBusy] = useState(false);

  const select = async (exercise: Exercise) => {
    if (busy || !routineId) return;
    setBusy(true);
    await addExerciseToRoutine(db, routineId, exercise);
    router.back();
  };

  return <ExerciseLibrary onSelect={select} />;
}
