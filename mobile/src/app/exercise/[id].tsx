import { useLocalSearchParams } from 'expo-router';

import { ExerciseDetail } from '@/features/exercises/exercise-detail';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExerciseDetail id={id} />;
}
