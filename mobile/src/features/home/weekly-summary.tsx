import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDuration, type WeekTotals } from '@/lib/stats';
import { Radius, Spacing } from '@/theme';
import { formatVolume } from '@/lib/format';

const STREAK_ORANGE = '#F59E2B';

type Props = { current: WeekTotals; previous: WeekTotals; streak: number; goal?: number | null };

/** «Ditt ukentlige sammendrag»: ukesrekke og denne ukens tall med endring fra forrige uke. */
export function WeeklySummary({ current, previous, streak, goal = null }: Props) {
  const theme = useTheme();
  const kg = (v: number) => formatVolume(v);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText accessibilityRole="header" type="smallBold" style={styles.title}>
          Ditt ukentlige sammendrag
        </ThemedText>
        <Pressable onPress={() => router.navigate('/profile')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Se mer på Du-siden">
          <ThemedText type="small" style={{ color: theme.accent, fontSize: 16 }}>
            Se mer
          </ThemedText>
        </Pressable>
      </View>
      <View style={styles.row}>
        <View style={styles.streak} accessible accessibilityLabel={`Ukesrekke: ${streak} ${streak === 1 ? 'uke' : 'uker'}`}>
          <View style={styles.flame}>
            <Icon name="flame.fill" size={52} color={streak > 0 ? STREAK_ORANGE : theme.backgroundSelected} fallback="🔥" />
            <ThemedText style={styles.streakNumber}>{streak}</ThemedText>
          </View>
          <ThemedText type="smallBold" style={{ color: streak > 0 ? STREAK_ORANGE : theme.textSecondary }}>
            {streak === 1 ? 'Uke' : 'Uker'}
          </ThemedText>
        </View>
        <Metric label="Økter" value={String(current.workouts)} delta={current.workouts - previous.workouts} format={String} />
        <Metric label="Varighet" value={formatShortDuration(current.seconds)} delta={current.seconds - previous.seconds} format={formatShortDuration} />
        <Metric label="Volum" value={kg(current.volumeKg)} delta={current.volumeKg - previous.volumeKg} format={kg} />
      </View>
      {goal !== null && (
        <View
          style={styles.goal}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Ukesmål"
          accessibilityValue={{ min: 0, max: goal, now: Math.min(current.workouts, goal), text: `${current.workouts} av ${goal} økter` }}>
          <View style={styles.goalHead}>
            <ThemedText type="smallBold">Ukesmål</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {current.workouts >= goal ? `Nådd! ${current.workouts} av ${goal} økter 🎉` : `${current.workouts} av ${goal} økter`}
            </ThemedText>
          </View>
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[
                styles.fillBar,
                { width: `${Math.min(100, (current.workouts / goal) * 100)}%`, backgroundColor: current.workouts >= goal ? theme.successFill : theme.accentFill },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function Metric({ label, value, delta, format }: { label: string; value: string; delta: number; format: (n: number) => string }) {
  const theme = useTheme();
  const up = delta > 0;
  const color = up ? theme.success : theme.danger;
  const show = Math.abs(delta) >= 1;
  const change = show ? `, ${up ? 'opp' : 'ned'} ${format(Math.abs(delta))} fra forrige uke` : '';
  return (
    <View style={styles.metric} accessible accessibilityLabel={`${label}: ${value}${change}`}>
      <ThemedText style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {show && (
        <View style={[styles.delta, { backgroundColor: `${color}1F` }]}>
          <ThemedText type="small" style={{ color }} numberOfLines={1}>
            {up ? '▲' : '▼'} {format(Math.abs(delta))}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  streak: { alignItems: 'center', width: 64 },
  flame: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  streakNumber: { position: 'absolute', top: 18, color: '#FFFFFF', fontSize: 20, lineHeight: 24, fontWeight: 800 },
  metric: { flex: 1, gap: 2, alignItems: 'flex-start' },
  goal: { gap: Spacing.two },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fillBar: { height: 8, borderRadius: 4 },
  value: { fontSize: 20, lineHeight: 26, fontWeight: 700, fontVariant: ['tabular-nums'] },
  delta: { marginTop: Spacing.one, paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.medium },
});
