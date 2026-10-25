import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionCard } from '@/components/action-card';
import { CalendarGlyph } from '@/components/calendar-glyph';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { StartWorkoutButton } from '@/features/home/start-workout-button';
import { RestDay } from '@/features/training/rest-day';
import { TrainingDayCard } from '@/features/training/training-day-card';
import { WeekPager } from '@/features/training/week-pager';
import { sameDay } from '@/features/training/week-strip';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { defaultWorkoutName, formatVolume } from '@/lib/format';
import { recordsPerWorkout, weekStreak, weeklySummary } from '@/lib/stats';
import { getActiveWorkout, listFinishedWorkoutsDetailed, startWorkout } from '@/storage/workout-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';

const STREAK_ORANGE = '#F59E2B';

const loadTraining = async (db: SQLiteDatabase) => ({
  active: await getActiveWorkout(db),
  workouts: await listFinishedWorkoutsDetailed(db),
});

/** Trening: ukestripe, dagens økter eller snarveier for å starte, og innsikt. */
export default function TrainingTab() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { state } = useLocalQuery(loadTraining);
  const [selected, setSelected] = useState(() => new Date());
  const today = new Date();

  const data = state.status === 'ready' ? state.data : null;
  const derived = useMemo(() => {
    if (!data) return null;
    return {
      trainedDays: new Set(data.workouts.map((w) => new Date(w.startedAt).toDateString())),
      streak: weekStreak(data.workouts),
      week: weeklySummary(data.workouts).current,
      records: recordsPerWorkout(data.workouts),
    };
  }, [data]);
  const dayWorkouts = (data?.workouts ?? []).filter((w) => sameDay(new Date(w.startedAt), selected));
  const isToday = sameDay(selected, today);

  const startNew = async () => {
    if (!data?.active) await startWorkout(db, defaultWorkoutName());
    router.push('/workout');
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.backgroundGrouped }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.background }}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push('/me')} accessibilityRole="button" accessibilityLabel="Din profil">
            <Avatar size={44} />
          </Pressable>
          <ThemedText style={styles.topTitle} accessibilityRole="header">
            {selected.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}
          </ThemedText>
          <View style={styles.topActions}>
            {!isToday && (
              <Pressable onPress={() => setSelected(new Date())} hitSlop={8} accessibilityRole="button" accessibilityLabel="Gå til i dag">
                <CalendarGlyph day={today.getDate()} />
              </Pressable>
            )}
            <Pressable onPress={() => router.push('/calendar')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Månedskalender">
              <CalendarGlyph />
            </Pressable>
          </View>
        </View>
        <View style={[styles.weekArea, { borderBottomColor: theme.backgroundSelected }]}>
          <WeekPager trainedDays={derived?.trainedDays ?? new Set()} selected={selected} onSelect={setSelected} today={today} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        {!isToday && dayWorkouts.length === 0 ? (
          <RestDay />
        ) : (
          <>
        {data?.active && (
          <ActionCard
            icon="play.circle.fill"
            title="Fortsett økten"
            subtitle={data.active.name}
            onPress={() => router.push('/workout')}
          />
        )}

        {dayWorkouts.length > 0 ? (
          <>
            <ThemedText accessibilityRole="header" style={styles.section}>Treninger</ThemedText>
            {dayWorkouts.map((w) => (
              <TrainingDayCard key={w.id} workout={w} records={derived?.records.get(w.id) ?? 0} />
            ))}
          </>
        ) : (
          <ThemedText accessibilityRole="header" style={styles.section}>Ingen økter i dag</ThemedText>
        )}

        {isToday && !data?.active && (
          <ActionCard icon="play.circle" title="Start ny økt" subtitle="Start en ny, ikke planlagt økt" onPress={startNew} />
        )}
        {isToday && (
          <ActionCard
            icon="magnifyingglass"
            title="Finn en plan"
            subtitle="Bla gjennom programmer og start en strukturert plan"
            onPress={() => router.navigate('/explore')}
          />
        )}

        <ThemedText accessibilityRole="header" style={[styles.section, styles.insightTitle]}>Min innsikt</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.insights} style={styles.insightScroll}>
          <View style={[styles.insightCard, { backgroundColor: theme.card }]}>
            <View style={styles.streakRow}>
              <Icon name="flame.fill" size={34} color={derived?.streak ? STREAK_ORANGE : theme.backgroundSelected} fallback="🔥" />
              <ThemedText style={styles.insightValue}>{derived?.streak ?? 0}</ThemedText>
            </View>
            <ThemedText themeColor="textSecondary">{derived?.streak === 1 ? 'Uke på rad' : 'Uker på rad'}</ThemedText>
          </View>
          <View style={[styles.insightCard, { backgroundColor: theme.card }]}>
            <ThemedText style={styles.insightValue}>{derived?.week.workouts ?? 0}</ThemedText>
            <ThemedText themeColor="textSecondary">Økter denne uken</ThemedText>
          </View>
          <View style={[styles.insightCard, { backgroundColor: theme.card }]}>
            <ThemedText style={styles.insightValueSmall} numberOfLines={1} adjustsFontSizeToFit>
              {formatVolume(derived?.week.volumeKg ?? 0)}
            </ThemedText>
            <ThemedText themeColor="textSecondary">Volum denne uken</ThemedText>
          </View>
        </ScrollView>
          </>
        )}
        <View style={styles.footer} />
      </ScrollView>

      {data && <StartWorkoutButton active={data.active} />}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: 700 },
  weekArea: { paddingHorizontal: Spacing.two, paddingTop: Spacing.three, paddingBottom: Spacing.four, borderBottomWidth: StyleSheet.hairlineWidth },
  content: { padding: Spacing.four, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  section: { fontSize: 20, lineHeight: 26, fontWeight: 600, marginTop: Spacing.three, textTransform: 'none' },
  insightTitle: { marginTop: Spacing.four },
  insightScroll: { marginHorizontal: -Spacing.four },
  insights: { flexDirection: 'row', gap: Spacing.three, paddingHorizontal: Spacing.four },
  insightCard: {
    width: 150,
    height: 150,
    borderRadius: Radius.large,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: Spacing.three,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  insightValue: { fontSize: 34, lineHeight: 42, fontWeight: 700, fontVariant: ['tabular-nums'] },
  insightValueSmall: { fontSize: 28, lineHeight: 34, fontWeight: 700, fontVariant: ['tabular-nums'] },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  footer: { height: 160 },
});
