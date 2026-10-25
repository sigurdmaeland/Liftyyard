import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formatVolume } from '@/lib/format';
import { computeTotals } from '@/lib/metrics';
import { formatRelativeDateTime, formatShortDuration } from '@/lib/stats';
import { Radius, Spacing } from '@/theme';
import type { Workout } from '@/types/workout';

const MEDAL = '#E0A82E';

/** Kort for en gjennomført økt i Trening-fanen: grønn stripe, navn, tid og nøkkeltall. */
export function TrainingDayCard({ workout, records }: { workout: Workout; records: number }) {
  const theme = useTheme();
  const t = computeTotals(workout.exercises);
  const seconds = (new Date(workout.endedAt ?? workout.startedAt).getTime() - new Date(workout.startedAt).getTime()) / 1000;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/history/[id]', params: { id: workout.id } })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.stripe, { backgroundColor: theme.success }]} />
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="dumbbell" size={30} color={theme.text} fallback="•" />
          </View>
          <View style={styles.titleBlock}>
            <ThemedText accessibilityRole="header" style={styles.title} numberOfLines={2}>
              {workout.name}
            </ThemedText>
            <ThemedText themeColor="textSecondary">{formatRelativeDateTime(workout.startedAt)}</ThemedText>
          </View>
        </View>
        <View style={styles.stats}>
          <Stat label="Varighet" value={formatShortDuration(seconds)} />
          <Stat label="Volum" value={formatVolume(t.volumeKg)} />
          {records > 0 && (
            <View style={styles.stat}>
              <ThemedText themeColor="textSecondary">Rekorder</ThemedText>
              <View style={styles.recordRow}>
                <Icon name="medal.fill" size={20} color={MEDAL} fallback="🏅" />
                <ThemedText style={styles.value}>{records}</ThemedText>
              </View>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
      <ThemedText style={styles.value}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: Radius.large,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  stripe: { width: 10 },
  body: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  thumb: { width: 56, height: 56, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1, gap: 2 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: 600 },
  stats: { flexDirection: 'row', gap: Spacing.four },
  stat: { gap: 2 },
  value: { fontSize: 18, lineHeight: 24, fontWeight: 700, fontVariant: ['tabular-nums'] },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
