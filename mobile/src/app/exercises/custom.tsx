import { router } from 'expo-router';

import { ListTile } from '@/components/list-tile';
import { ExerciseListScreen } from '@/features/exercises/exercise-list-screen';
import { listCustomExercises } from '@/storage/exercise-store';

export default function CustomExercisesScreen() {
  return (
    <ExerciseListScreen
      load={listCustomExercises}
      empty="Du har ingen egendefinerte øvelser ennå."
      header={<ListTile icon="plus" title="Lag en egendefinert øvelse" onPress={() => router.push('/exercise/edit')} />}
    />
  );
}
