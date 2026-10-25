import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { SyncBadge } from '@/features/history/sync-badge';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatDuration, formatVolume, secondsBetween } from '@/lib/format';
import { Radius, Spacing } from '@/theme';
import type { WorkoutSummary } from '@/types/workout';

export function WorkoutListItem({ workout }: { workout: WorkoutSummary }) {
  const theme = useTheme();
  const { totals } = workout;
  return (
    <Link href={{ pathname: '/history/[id]', params: { id: workout.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 }]}>
        <View style={styles.header}>
          <ThemedText type="smallBold" style={styles.name} numberOfLines={1}>
            {workout.name}
          </ThemedText>
          <SyncBadge status={workout.syncStatus} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(workout.startedAt)} · {formatDuration(secondsBetween(workout.startedAt, workout.endedAt))}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {totals.exerciseCount} øvelser · {totals.completedSetCount} sett · {formatVolume(totals.volumeKg)}
        </ThemedText>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Radius.large, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  name: { flex: 1, fontSize: 16 },
});
