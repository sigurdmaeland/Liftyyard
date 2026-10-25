import type { SQLiteDatabase } from 'expo-sqlite';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { FeedCard } from '@/features/social/feed-card';
import { localFeedItem } from '@/features/social/local-feed-item';
import { useProfile } from '@/hooks/use-profile';
import { listLocalPhotoUris } from '@/storage/photo-store';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { recordSummaryPerWorkout } from '@/lib/stats';
import { listFinishedWorkoutsDetailed } from '@/storage/workout-store';
import { MaxContentWidth, Spacing } from '@/theme';

const load = async (db: SQLiteDatabase) => ({ workouts: await listFinishedWorkoutsDetailed(db, 5000), photos: await listLocalPhotoUris(db) });

/** Treningshistorie: alle fullførte økter som kort, nyeste først. */
export default function TrainingHistoryScreen() {
  const theme = useTheme();
  const { state } = useLocalQuery(load);
  const workouts = useMemo(() => (state.status === 'ready' ? state.data.workouts : []), [state]);
  const profile = useProfile();
  const records = useMemo(() => recordSummaryPerWorkout(workouts), [workouts]);

  return (
    <FlatList
      data={workouts}
      keyExtractor={(w) => w.id}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.backgroundElement }]} />}
      renderItem={({ item }) => (
        <FeedCard
          item={localFeedItem(item, profile, state.status === 'ready' ? state.data.photos.get(item.id) : undefined)}
          syncStatus={item.syncStatus}
          records={records.get(item.id)}
        />
      )}
      ListEmptyComponent={
        state.status === 'ready' ? (
          <EmptyState icon="clock.arrow.circlepath" title="Ingen økter ennå" text="Når du fullfører en økt, havner den her." />
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.four, paddingBottom: 60, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  separator: { height: 8, marginHorizontal: -Spacing.four },
  empty: { textAlign: 'center', marginTop: Spacing.five },
});
