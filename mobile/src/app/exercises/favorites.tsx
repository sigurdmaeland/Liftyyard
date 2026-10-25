import { router } from 'expo-router';

import { ListTile } from '@/components/list-tile';
import { ExerciseListScreen } from '@/features/exercises/exercise-list-screen';
import { listFavoriteExercises } from '@/storage/exercise-store';

export default function FavoriteExercisesScreen() {
  return (
    <ExerciseListScreen
      load={listFavoriteExercises}
      empty="Ingen favorittøvelser ennå. Åpne en øvelse og trykk på bokmerket for å lagre den her."
      header={<ListTile icon="magnifyingglass" title="Finn øvelser" onPress={() => router.push('/exercises/library')} />}
    />
  );
}
