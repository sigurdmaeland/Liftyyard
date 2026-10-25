import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { ScrollView, StyleSheet } from 'react-native';

import { ListTile } from '@/components/list-tile';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLocalQuery } from '@/hooks/use-local-query';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '@/lib/labels';
import { Spacing } from '@/theme';
import type { Exercise } from '@/types/workout';

/** Felles liste for favoritt- og egendefinerte øvelser i Bibliotek. */
export function ExerciseListScreen({
  load,
  empty,
  header,
}: {
  load: (db: SQLiteDatabase) => Promise<Exercise[]>;
  empty: string;
  header?: React.ReactNode;
}) {
  const { state } = useLocalQuery(load);
  const exercises = state.status === 'ready' ? state.data : [];
  return (
    <ThemedView style={styles.fill}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        {header}
        {state.status === 'ready' && exercises.length === 0 && <ThemedText themeColor="textSecondary">{empty}</ThemedText>}
        {exercises.map((e) => (
          <ListTile
            key={e.id}
            icon="dumbbell"
            title={e.name}
            subtitle={[e.primaryMuscles.map((m) => MUSCLE_LABELS[m] ?? m).join(', '), EQUIPMENT_LABELS[e.equipment]].filter(Boolean).join(' · ')}
            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.id } })}
          />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: Spacing.six },
});
