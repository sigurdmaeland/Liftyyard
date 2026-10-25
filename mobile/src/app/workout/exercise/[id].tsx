import { Stack, router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RestTimerBar } from '@/features/workout/rest-timer-bar';
import { SetsEditor } from '@/features/workout/sets-editor';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { getActiveWorkout } from '@/storage/workout-store';
import { MaxContentWidth, Spacing } from '@/theme';

/** Loggeskjerm for én øvelse i den aktive økten, med «Forrige» og «Neste» mellom øvelsene. */
export default function WorkoutExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { state, reload } = useLocalQuery(getActiveWorkout);

  const workout = state.status === 'ready' ? state.data : null;
  const index = workout ? workout.exercises.findIndex((e) => e.id === id) : -1;
  const exercise = workout && index >= 0 ? workout.exercises[index] : null;

  if (!workout || !exercise) {
    return (
      <ThemedView style={[styles.fill, styles.center]}>
        {state.status === 'ready' && <ThemedText themeColor="textSecondary">Øvelsen finnes ikke lenger i økten.</ThemedText>}
      </ThemedView>
    );
  }

  const prev = workout.exercises[index - 1];
  const next = workout.exercises[index + 1];
  const go = (target: { id: string }) => router.replace({ pathname: '/workout/exercise/[id]', params: { id: target.id } });

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen
        options={{
          title: exercise.exerciseName,
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/workout/exercise-menu', params: { id: exercise.id } })}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Valg for øvelsen">
              <Icon name="ellipsis.circle" color={theme.accent} fallback="⋯" />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="small" themeColor="textSecondary">
            Øvelse {index + 1} av {workout.exercises.length} · Trykk på settnummeret for å bytte type, hold for å slette
          </ThemedText>
          <SetsEditor key={exercise.id} workoutId={workout.id} exercise={exercise} onChanged={reload} />
          <View style={styles.nav}>
            <Button
              label={prev ? `‹ ${prev.exerciseName}` : 'Til oversikten'}
              variant="secondary"
              onPress={() => (prev ? go(prev) : router.back())}
              style={styles.navButton}
            />
            <Button
              label={next ? `${next.exerciseName} ›` : 'Ferdig'}
              onPress={() => (next ? go(next) : router.back())}
              style={styles.navButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <RestTimerBar />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 140, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  nav: { flexDirection: 'row', gap: Spacing.two },
  navButton: { flex: 1, paddingHorizontal: Spacing.two },
});
