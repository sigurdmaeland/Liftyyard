import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { getActiveWorkout, setExerciseNotes, setWorkoutNotes } from '@/storage/workout-store';
import { Radius, Spacing } from '@/theme';
import type { Workout } from '@/types/workout';

/** Notat-ark: private notater for økten, eller notat for én øvelse (?exercise=<id>). */
export default function NotesSheet() {
  const { exercise } = useLocalSearchParams<{ exercise?: string }>();
  const { state } = useLocalQuery(getActiveWorkout);
  if (state.status !== 'ready' || !state.data) return <ThemedView style={styles.sheet} />;
  return <NotesEditor workout={state.data} exerciseId={exercise} />;
}

function NotesEditor({ workout, exerciseId }: { workout: Workout; exerciseId?: string }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const target = exerciseId ? workout.exercises.find((e) => e.id === exerciseId) : null;
  const [text, setText] = useState((target ? target.notes : workout.notes) ?? '');

  const save = async () => {
    if (target) await setExerciseNotes(db, target.id, text.trim());
    else await setWorkoutNotes(db, workout.id, text.trim());
    router.back();
  };

  return (
    <ThemedView style={styles.sheet}>
      <ThemedText accessibilityRole="header" type="smallBold" style={styles.title}>
        {target ? `Notat · ${target.exerciseName}` : 'Private notater'}
      </ThemedText>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={target ? 'F.eks. setehøyde 4, smalt grep' : 'Bare synlig for deg'}
        placeholderTextColor={theme.textSecondary}
        multiline
        autoFocus
        maxLength={2000}
        accessibilityLabel={target ? `Notat for ${target.exerciseName}` : 'Private notater for økten'}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
      />
      <View style={styles.actions}>
        <Button label="Avbryt" variant="secondary" onPress={() => router.back()} style={styles.button} />
        <Button label="Lagre" onPress={save} style={styles.button} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: Spacing.three, gap: Spacing.three, minHeight: 320 },
  title: { fontSize: 17, textAlign: 'center' },
  input: { height: 140, borderRadius: Radius.medium, padding: Spacing.three, fontSize: 16, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  button: { flex: 1 },
});
