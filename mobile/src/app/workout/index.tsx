import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ElapsedTime } from '@/components/elapsed-time';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RestTimerBar } from '@/features/workout/rest-timer-bar';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { formatVolume } from '@/lib/format';
import { computeTotals } from '@/lib/metrics';
import { getActiveWorkout, renameWorkout } from '@/storage/workout-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';
import type { Workout } from '@/types/workout';

export default function ActiveWorkoutScreen() {
  const { state } = useLocalQuery(getActiveWorkout);

  if (state.status === 'loading') return <ThemedView style={styles.fill} />;
  if (state.status === 'error' || !state.data) {
    return (
      <ThemedView style={[styles.fill, styles.center]}>
        <ThemedText themeColor="textSecondary">Ingen pågående økt.</ThemedText>
        <Button label="Til forsiden" variant="ghost" onPress={() => router.dismissTo('/')} />
      </ThemedView>
    );
  }
  return <WorkoutOverview key={state.data.id} workout={state.data} />;
}

/** Oversikt over den aktive økten: nøkkeltall, øvelsesliste, «Legg til øvelser» og «Mer». */
function WorkoutOverview({ workout }: { workout: Workout }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [name, setName] = useState(workout.name);
  const totals = computeTotals(workout.exercises);
  const canFinish = totals.completedSetCount > 0;
  // Økten dekker hele skjermen, så toppmargen er alltid statuslinjens høyde. SafeAreaView måler
  // av og til 0 mens fullskjermvinduet glir inn, og da havnet knappene oppe i statuslinjen.
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, initialWindowMetrics?.insets.top ?? 0);

  const confirmFinish = () => {
    if (!canFinish) {
      Alert.alert('Ingen fullførte sett', 'Marker minst ett sett med ✓ før du fullfører, eller avbryt økten under «Mer».');
      return;
    }
    router.push('/workout/finish');
  };

  return (
    <ThemedView style={styles.fill}>
      <View style={[styles.fill, { paddingTop: top }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Minimer økten">
            <Icon name="chevron.down" color={theme.text} fallback="⌄" />
          </Pressable>
          <Pressable onPress={() => router.push('/workout/rest')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Hviletimer">
            <Icon name="timer" color={theme.text} fallback="⏱" />
          </Pressable>
          <View style={styles.spacer} />
          <Pressable
            onPress={confirmFinish}
            accessibilityRole="button"
            accessibilityLabel="Fullfør økten"
            accessibilityHint={canFinish ? undefined : 'Marker minst ett sett som fullført først'}
            style={({ pressed }) => [
              styles.finish,
              { backgroundColor: theme.accentFill, opacity: !canFinish ? 0.45 : pressed ? 0.8 : 1 },
            ]}>
            <ThemedText type="smallBold" style={styles.finishLabel}>
              Fullfør
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <TextInput
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (t.trim()) renameWorkout(db, workout.id, t.trim()).catch(() => {});
            }}
            style={[styles.nameInput, { color: theme.text }]}
            accessibilityLabel="Navn på økten"
            maxLength={100}
          />

          <View style={[styles.stats, { borderColor: theme.backgroundSelected }]}>
            <StatCell label="Varighet">
              <ElapsedTime since={workout.startedAt} style={[styles.statValue, { color: theme.accent }]} />
            </StatCell>
            <StatCell label="Volum">
              <ThemedText style={styles.statValue}>{formatVolume(totals.volumeKg)}</ThemedText>
            </StatCell>
            <StatCell label="Sett">
              <ThemedText style={styles.statValue}>{totals.completedSetCount}</ThemedText>
            </StatCell>
          </View>

          <View style={[styles.list, { backgroundColor: theme.backgroundElement }]}>
            {workout.exercises.length === 0 && (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Ingen øvelser ennå.
              </ThemedText>
            )}
            {workout.exercises.map((e) => {
              const done = e.sets.filter((s) => s.completedAt).length;
              const allDone = done > 0 && done === e.sets.length;
              return (
                <Pressable
                  key={e.id}
                  onPress={() => router.push({ pathname: '/workout/exercise/[id]', params: { id: e.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.exerciseName}${e.supersetGroup !== null ? ', i supersett' : ''}, ${done} av ${e.sets.length} sett fullført`}
                  style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
                  {e.supersetGroup !== null && <View style={[styles.supersetBar, { backgroundColor: theme.accent }]} />}
                  <View style={[styles.thumb, { backgroundColor: allDone ? theme.successFill : theme.background }]}>
                    <Icon
                      name={allDone ? 'checkmark' : 'dumbbell.fill'}
                      color={allDone ? '#FFFFFF' : theme.textSecondary}
                      fallback={allDone ? '✓' : '•'}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <ThemedText type="smallBold" style={styles.rowTitle} numberOfLines={1}>
                      {e.exerciseName}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {e.supersetGroup !== null ? 'Supersett · ' : ''}
                      {done}/{e.sets.length} fullført
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => router.push({ pathname: '/workout/exercise-menu', params: { id: e.id } })}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={`Valg for ${e.exerciseName}`}>
                    <Icon name="ellipsis" color={theme.accent} fallback="⋯" />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => router.push('/workout/add-exercise')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.pill, { backgroundColor: theme.text, opacity: pressed ? 0.85 : 1 }]}>
            <ThemedText type="smallBold" style={[styles.pillLabel, { color: theme.background }]}>
              Legg til øvelser
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => router.push('/workout/more')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.pill, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 }]}>
            <ThemedText type="smallBold" style={styles.pillLabel}>
              Mer
            </ThemedText>
          </Pressable>
        </ScrollView>
        <RestTimerBar />
      </View>
    </ThemedView>
  );
}

function StatCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.statCell}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  spacer: { flex: 1 },
  finish: { paddingHorizontal: Spacing.four, minHeight: 44, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  finishLabel: { color: '#FFFFFF', fontSize: 16 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 120, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  nameInput: { fontSize: 24, fontWeight: 700, paddingVertical: 0 },
  stats: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.large, paddingVertical: Spacing.three },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, lineHeight: 24, fontWeight: 700, fontVariant: ['tabular-nums'] },
  list: { borderRadius: Radius.large, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
  empty: { padding: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two, paddingHorizontal: Spacing.one },
  supersetBar: { position: 'absolute', left: 0, top: 6, bottom: 6, width: 4, borderRadius: 2 },
  thumb: { width: 52, height: 52, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 17 },
  pill: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  pillLabel: { fontSize: 17 },
});
