import { Stack, useLocalSearchParams } from 'expo-router';
import { type SQLiteDatabase } from 'expo-sqlite';
import { useCallback } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { TrainingDayCard } from '@/features/training/training-day-card';
import { sameDay } from '@/features/training/week-strip';
import { useLocalQuery } from '@/hooks/use-local-query';
import { recordsPerWorkout } from '@/lib/stats';
import { listFinishedWorkoutsDetailed } from '@/storage/workout-store';
import { Spacing } from '@/theme';

/** Alle økter en bestemt dag (fra månedskalenderen når det er flere enn én). */
export default function CalendarDayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const day = new Date(date);
  const query = useCallback(async (db: SQLiteDatabase) => {
    const all = await listFinishedWorkoutsDetailed(db, 5000);
    return { all, records: recordsPerWorkout(all) };
  }, []);
  const { state } = useLocalQuery(query);
  const workouts = state.status === 'ready' ? state.data.all.filter((w) => sameDay(new Date(w.startedAt), day)) : [];

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ title: day.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }) }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        {workouts.map((w) => (
          <TrainingDayCard key={w.id} workout={w} records={state.status === 'ready' ? (state.data.records.get(w.id) ?? 0) : 0} />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
});
