import { FlatList, StyleSheet } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ThemedView } from '@/components/themed-view';
import { WorkoutListItem } from '@/features/history/workout-list-item';
import { useLocalQuery } from '@/hooks/use-local-query';
import { listFinishedWorkouts } from '@/storage/workout-store';
import { Spacing } from '@/theme';

export default function HistoryScreen() {
  const { state } = useLocalQuery(listFinishedWorkouts);
  return (
    <ThemedView style={styles.fill}>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={state.status === 'ready' ? state.data : []}
        keyExtractor={(w) => w.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <WorkoutListItem workout={item} />}
        ListEmptyComponent={
          state.status === 'ready' ? (
            <EmptyState icon="clock.arrow.circlepath" title="Ingen økter ennå" text="Fullførte økter samles her." />
          ) : undefined
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.three },
});
