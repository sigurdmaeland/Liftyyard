import { router, useLocalSearchParams } from 'expo-router';

import { ExerciseDetail } from '@/features/exercises/exercise-detail';

/** «Detaljer og historikk» fra øvelsesmenyen i en aktiv økt. */
export default function WorkoutExerciseInfoScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  return (
    <ExerciseDetail
      id={exerciseId}
      onOpenExercise={(id) => router.push({ pathname: '/workout/exercise-info', params: { exerciseId: id } })}
    />
  );
}
