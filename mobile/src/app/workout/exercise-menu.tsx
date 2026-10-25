import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { type SheetAction, SheetActions } from '@/components/sheet-actions';
import { ThemedView } from '@/components/themed-view';
import { useLocalQuery } from '@/hooks/use-local-query';
import { getActiveWorkout, moveWorkoutExercise, removeWorkoutExercise, setSuperset } from '@/storage/workout-store';

/**
 * Valg for én øvelse i økten: detaljer, bytte, notat, flytte, supersett med neste øvelse og fjerne.
 */
export default function ExerciseMenuSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { state } = useLocalQuery(getActiveWorkout);
  const workout = state.status === 'ready' ? state.data : null;
  const index = workout ? workout.exercises.findIndex((e) => e.id === id) : -1;
  if (!workout || index < 0) return <ThemedView style={{ height: 120 }} />;
  const exercise = workout.exercises[index];

  const run = (op: Promise<unknown>) => op.then(() => router.back());

  const actions: SheetAction[] = [
    {
      key: 'info',
      label: 'Detaljer og historikk',
      icon: 'clock.arrow.circlepath',
      onPress: () => router.replace({ pathname: '/workout/exercise-info', params: { exerciseId: exercise.exerciseId } }),
    },
    {
      key: 'replace',
      label: 'Bytt øvelse',
      icon: 'arrow.left.arrow.right',
      onPress: () => router.replace({ pathname: '/workout/add-exercise', params: { replace: exercise.id } }),
    },
    {
      key: 'note',
      label: 'Notat for øvelsen',
      icon: 'pin',
      onPress: () => router.replace({ pathname: '/workout/notes', params: { exercise: exercise.id } }),
    },
  ];
  if (exercise.exerciseType === 'WEIGHT_REPS') {
    const heaviest = Math.max(0, ...exercise.sets.map((s) => s.weightKg ?? 0));
    actions.push({
      key: 'plates',
      label: 'Skivekalkulator',
      icon: 'circle.grid.2x1',
      onPress: () => router.replace({ pathname: '/workout/plates', params: heaviest > 0 ? { weight: String(heaviest) } : {} }),
    });
  }
  if (index > 0) {
    actions.push({
      key: 'up',
      label: 'Flytt opp',
      icon: 'arrow.up',
      onPress: () => run(moveWorkoutExercise(db, workout.id, exercise.id, -1)),
    });
  }
  if (index < workout.exercises.length - 1) {
    actions.push({
      key: 'down',
      label: 'Flytt ned',
      icon: 'arrow.down',
      onPress: () => run(moveWorkoutExercise(db, workout.id, exercise.id, 1)),
    });
  }
  const next = workout.exercises[index + 1];
  if (next && (exercise.supersetGroup === null || exercise.supersetGroup !== next.supersetGroup)) {
    actions.push({
      key: 'superset',
      label: `Supersett med ${next.exerciseName}`,
      icon: 'link',
      onPress: () => run(setSuperset(db, workout.id, exercise.id, true)),
    });
  }
  if (exercise.supersetGroup !== null) {
    actions.push({
      key: 'unsuperset',
      label: 'Fjern fra supersett',
      icon: 'link.badge.plus',
      onPress: () => run(setSuperset(db, workout.id, exercise.id, false)),
    });
  }
  actions.push({
    key: 'delete',
    label: 'Fjern fra økten',
    icon: 'trash',
    destructive: true,
    onPress: () => {
      removeWorkoutExercise(db, workout.id, exercise.id).then(() => router.dismissTo('/workout'));
    },
  });

  return (
    <ThemedView>
      <SheetActions title={exercise.exerciseName} actions={actions} />
    </ThemedView>
  );
}
