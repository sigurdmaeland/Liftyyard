import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert } from 'react-native';

import { SheetActions } from '@/components/sheet-actions';
import { ThemedView } from '@/components/themed-view';
import { restTimer } from '@/features/workout/rest-timer';
import { discardWorkout, getActiveWorkout } from '@/storage/workout-store';

/** «Mer»-arket i en aktiv økt. Bilder og deling kommer når media-lagring og community er på plass. */
export default function WorkoutMoreSheet() {
  const db = useSQLiteContext();

  const discard = () => {
    Alert.alert('Avbryte økten?', 'Alt du har registrert i denne økten slettes.', [
      { text: 'Behold', style: 'cancel' },
      {
        text: 'Avbryt økten',
        style: 'destructive',
        onPress: async () => {
          const w = await getActiveWorkout(db);
          if (w) await discardWorkout(db, w.id);
          restTimer.stop();
          router.dismissTo('/');
        },
      },
    ]);
  };

  return (
    <ThemedView>
      <SheetActions
        actions={[
          {
            key: 'notes',
            label: 'Private notater',
            icon: 'square.and.pencil',
            onPress: () => router.replace('/workout/notes'),
          },
          { key: 'rest', label: 'Hviletimer', icon: 'timer', onPress: () => router.replace('/workout/rest') },
          { key: 'plates', label: 'Skivekalkulator', icon: 'circle.grid.2x1', onPress: () => router.replace('/workout/plates') },
          { key: 'discard', label: 'Avbryt økten', icon: 'trash', destructive: true, onPress: discard },
        ]}
      />
    </ThemedView>
  );
}
