import { StyleSheet, View } from 'react-native';

import { BodyMap, type MuscleLoad } from '@/components/body-map';
import { ThemedText } from '@/components/themed-text';
import { RecordSummary } from '@/features/workout-view/medals';
import type { Medal } from '@/lib/records';
import { Spacing } from '@/theme';

export type OverviewStat = { label: string; value: string };

/** Muskelkart forfra og bakfra med nøkkeltall i en kolonne ved siden av. */
export function WorkoutOverview({
  load,
  stats,
  records,
}: {
  load: MuscleLoad;
  stats: OverviewStat[];
  records?: { medals: Medal[]; count: number };
}) {
  return (
    <View style={styles.row}>
      <View style={styles.map}>
        <BodyMap load={load} height={200} />
      </View>
      <View style={styles.stats}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat} accessible accessibilityLabel={`${s.label}: ${s.value}`}>
            <ThemedText type="small" themeColor="textSecondary">
              {s.label}
            </ThemedText>
            <ThemedText style={styles.value}>{s.value}</ThemedText>
          </View>
        ))}
        {records && records.count > 0 && (
          <View style={styles.stat}>
            <ThemedText type="small" themeColor="textSecondary">
              Rekorder
            </ThemedText>
            <RecordSummary medals={records.medals} count={records.count} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  map: { flexShrink: 1 },
  stats: { flex: 1, gap: Spacing.three, minWidth: 96 },
  stat: { gap: 2 },
  value: { fontSize: 20, lineHeight: 26, fontWeight: 700, fontVariant: ['tabular-nums'] },
});
