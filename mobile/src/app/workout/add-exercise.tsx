import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { ExerciseLibrary } from '@/features/exercises/exercise-library';
import { defaultWorkoutName } from '@/lib/format';
import { addExerciseToWorkout, replaceWorkoutExercise, startWorkout } from '@/storage/workout-store';
import type { Exercise } from '@/types/workout';

/** Velg øvelse: legger til i den aktive økten, eller bytter ut en øvelse (?replace=<id>). */
export default function AddExerciseScreen() {
  const db = useSQLiteContext();
  const { replace } = useLocalSearchParams<{ replace?: string }>();
  const [busy, setBusy] = useState(false);

  const select = async (exercise: Exercise) => {
    if (busy) return;
    setBusy(true);
    const workoutId = await startWorkout(db, defaultWorkoutName()); // Returnerer aktiv økt hvis den finnes.
    if (replace) await replaceWorkoutExercise(db, workoutId, replace, exercise);
    else await addExerciseToWorkout(db, workoutId, exercise);
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: replace ? 'Bytt øvelse' : 'Velg øvelse' }} />
      <ExerciseLibrary onSelect={select} />
    </>
  );
}
