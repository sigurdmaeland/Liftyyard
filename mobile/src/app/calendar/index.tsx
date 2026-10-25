import { Stack, router } from 'expo-router';
import { type SQLiteDatabase } from 'expo-sqlite';
import { type ComponentRef, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { sameDay } from '@/features/training/week-strip';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { weekStreak } from '@/lib/stats';
import { listFinishedWorkouts } from '@/storage/workout-store';
import { Spacing } from '@/theme';

const WEEKDAYS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];
const STREAK_ORANGE = '#F59E2B';
/** Minst så mange måneder bakover vises, også uten treningshistorikk. */
const MIN_MONTHS = 12;

const load = (db: SQLiteDatabase) => listFinishedWorkouts(db, 5000);

/** Månedskalender: inneværende måned nederst og tidligere måneder over. Treningsdager er markert. */
export default function CalendarScreen() {
  const theme = useTheme();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const { state } = useLocalQuery(load);
  const workouts = useMemo(() => (state.status === 'ready' ? state.data : []), [state]);
  const today = new Date();

  const byDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const w of workouts) {
      const key = new Date(w.startedAt).toDateString();
      map.set(key, [...(map.get(key) ?? []), w.id]);
    }
    return map;
  }, [workouts]);

  const months = useMemo(() => {
    const now = new Date();
    const earliest = workouts.reduce((min, w) => Math.min(min, new Date(w.startedAt).getTime()), now.getTime());
    const first = new Date(earliest);
    const count = Math.max(
      MIN_MONTHS,
      (now.getFullYear() - first.getFullYear()) * 12 + (now.getMonth() - first.getMonth()) + 1,
    );
    return Array.from({ length: count }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1));
  }, [workouts]);

  const openDay = (day: Date) => {
    const ids = byDay.get(day.toDateString()) ?? [];
    if (ids.length === 1) router.push({ pathname: '/history/[id]', params: { id: ids[0] } });
    else if (ids.length > 1) router.push({ pathname: '/calendar/day', params: { date: day.toISOString() } });
  };

  const streak = weekStreak(workouts);

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen
        options={{
          title: 'Måned',
          headerRight: () => (
            <View style={styles.streak} accessible accessibilityLabel={`Ukesrekke: ${streak}`}>
              <Icon name="flame.fill" size={20} color={STREAK_ORANGE} fallback="🔥" />
              <ThemedText style={[styles.streakText, { color: STREAK_ORANGE }]}>{streak}</ThemedText>
            </View>
          ),
        }}
      />
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        stickyHeaderIndices={[0]}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        <View style={[styles.weekdays, { backgroundColor: theme.background, borderBottomColor: theme.backgroundSelected }]}>
          {WEEKDAYS.map((d, i) => (
            <ThemedText key={i} type="small" themeColor="textSecondary" style={styles.weekday}>
              {d}
            </ThemedText>
          ))}
        </View>

        {months.map((month) => (
          <Month key={month.toISOString()} month={month} today={today} byDay={byDay} onOpen={openDay} />
        ))}
        <View style={styles.footer} />
      </ScrollView>
    </ThemedView>
  );
}

function Month({
  month,
  today,
  byDay,
  onOpen,
}: {
  month: Date;
  today: Date;
  byDay: Map<string, string[]>;
  onOpen: (d: Date) => void;
}) {
  const theme = useTheme();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leading = (month.getDay() + 6) % 7; // mandag = 0
  const cells: (Date | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
  const sameYear = month.getFullYear() === today.getFullYear();
  const title = month.toLocaleDateString('nb-NO', { month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });

  return (
    <View style={styles.month}>
      <ThemedText style={styles.monthTitle}>{title.charAt(0).toUpperCase() + title.slice(1)}</ThemedText>
      {rows.map((row, r) => (
        <View key={r} style={[styles.row, { borderBottomColor: theme.backgroundSelected }]}>
          {row.map((day, c) => {
            if (!day) return <View key={c} style={styles.cell} />;
            const count = byDay.get(day.toDateString())?.length ?? 0;
            const isToday = sameDay(day, today);
            const future = day.getTime() > today.getTime() && !isToday;
            return (
              <Pressable
                key={c}
                style={styles.cell}
                disabled={count === 0}
                onPress={() => onOpen(day)}
                accessibilityRole={count > 0 ? 'button' : 'text'}
                accessibilityLabel={`${day.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}${count > 0 ? `, ${count} ${count === 1 ? 'økt' : 'økter'}` : ''}`}>
                {count > 0 ? (
                  <>
                    <View style={[styles.circle, { backgroundColor: theme.text }]}>
                      <Icon name="dumbbell.fill" size={20} color={theme.background} fallback="•" />
                      {count > 1 && (
                        <View style={[styles.badge, { backgroundColor: theme.accentFill }]}>
                          <ThemedText style={styles.badgeText}>{count}</ThemedText>
                        </View>
                      )}
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.cellLabel} numberOfLines={1}>
                      Trening
                    </ThemedText>
                  </>
                ) : (
                  <View style={[styles.circle, isToday && { borderWidth: 2, borderColor: theme.text }]}>
                    <ThemedText style={[styles.date, { color: future ? theme.textSecondary : theme.text }]}>{day.getDate()}</ThemedText>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  streakText: { fontSize: 17, fontWeight: 700 },
  weekdays: { flexDirection: 'row', paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  weekday: { flex: 1, textAlign: 'center' },
  month: { paddingTop: Spacing.four },
  monthTitle: { fontSize: 28, lineHeight: 34, fontWeight: 700, paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { flex: 1, height: 76, alignItems: 'center', justifyContent: 'center', gap: 2 },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  date: { fontSize: 18, fontWeight: 600, fontVariant: ['tabular-nums'] },
  cellLabel: { fontSize: 11 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontWeight: 700 },
  footer: { height: 40 },
});
