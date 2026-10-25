import type { SQLiteDatabase } from 'expo-sqlite';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { startWorkoutFromRoutine } from '@/storage/workout-store';
import type { Routine } from '@/types/program';

/** Starter en økt fra rutinen. Pågår det allerede en økt, får brukeren valget om å fortsette den. */
export async function startRoutine(db: SQLiteDatabase, routine: Routine) {
  if (routine.exercises.length === 0) {
    Alert.alert('Tom rutine', 'Legg til minst én øvelse før du starter rutinen.');
    return;
  }
  const id = await startWorkoutFromRoutine(db, routine);
  if (id) {
    router.push('/workout');
    return;
  }
  Alert.alert('Du har en pågående økt', 'Fullfør eller avbryt den før du starter en ny.', [
    { text: 'Avbryt', style: 'cancel' },
    { text: 'Gå til økten', onPress: () => router.push('/workout') },
  ]);
}
