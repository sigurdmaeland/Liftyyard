import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { sameDay } from '@/features/training/week-strip';
import { useTheme } from '@/hooks/use-theme';
import { startOfWeek, weekStreak } from '@/lib/stats';
import { Spacing } from '@/theme';

const WEEKDAYS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];
export const STREAK_ORANGE = '#F59E2B';

type Item = { id: string; startedAt: string };

/**
 * Månedskalender med treningsdager markert og en kolonne til høyre som viser ukene i rekken:
 * en flamme med antall økter for uker med trening, en tom ring for uker uten.
 * Pilene blar mellom måneder; trykk på en treningsdag åpner økten.
 */
export function MonthCalendar({ workouts }: { workouts: Item[] }) {
  const theme = useTheme();
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const byDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const w of workouts) {
      const key = new Date(w.startedAt).toDateString();
      map.set(key, [...(map.get(key) ?? []), w.id]);
    }
    return map;
  }, [workouts]);
  const perWeek = useMemo(() => {
    const map = new Map<number, number>();
    for (const w of workouts) {
      const key = startOfWeek(new Date(w.startedAt)).getTime();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [workouts]);
  const streak = weekStreak(workouts);

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leading = (month.getDay() + 6) % 7;
  const cells: (Date | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
  const isCurrent = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const title = month.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });

  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const openDay = (day: Date) => {
    const ids = byDay.get(day.toDateString()) ?? [];
    if (ids.length === 1) router.push({ pathname: '/history/[id]', params: { id: ids[0] } });
    else if (ids.length > 1) router.push({ pathname: '/calendar/day', params: { date: day.toISOString() } });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <ThemedText accessibilityRole="header" style={styles.title}>{title.charAt(0).toUpperCase() + title.slice(1)}</ThemedText>
        <View style={styles.nav}>
          <Pressable onPress={() => shift(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Forrige måned">
            <Icon name="chevron.left" size={18} color={theme.text} fallback="‹" />
          </Pressable>
          <Pressable
            onPress={() => shift(1)}
            disabled={isCurrent}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Neste måned"
            style={{ opacity: isCurrent ? 0.3 : 1 }}>
            <Icon name="chevron.right" size={18} color={theme.text} fallback="›" />
          </Pressable>
        </View>
      </View>

      <View style={styles.row}>
        {WEEKDAYS.map((d, i) => (
          <ThemedText key={i} type="small" themeColor="textSecondary" style={styles.weekday}>
            {d}
          </ThemedText>
        ))}
        <View style={[styles.streakCol, styles.streakHead]}>
          <Icon name="flame.fill" size={14} color={theme.textSecondary} fallback="🔥" />
        </View>
      </View>

      {rows.map((row, r) => {
        const firstDay = row.find((d) => d !== null)!;
        const weekCount = perWeek.get(startOfWeek(firstDay).getTime()) ?? 0;
        return (
          <View key={r} style={styles.row}>
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
                  onPress={() => openDay(day)}
                  accessibilityRole={count > 0 ? 'button' : 'text'}
                  accessibilityLabel={`${day.getDate()}. ${count > 0 ? `${count} ${count === 1 ? 'økt' : 'økter'}` : ''}`}>
                  <View
                    style={[
                      styles.day,
                      count > 0 && { backgroundColor: theme.accentFill },
                      isToday && count === 0 && { borderWidth: 1.5, borderColor: theme.text },
                    ]}>
                    <ThemedText
                      style={[
                        styles.dayText,
                        { color: count > 0 ? '#FFFFFF' : future ? theme.textSecondary : theme.text },
                        count > 0 && styles.dayTextBold,
                      ]}>
                      {day.getDate()}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
            <View
              style={styles.streakCol}
              accessible
              accessibilityLabel={weekCount > 0 ? `${weekCount} ${weekCount === 1 ? 'økt' : 'økter'} denne uken` : 'Ingen økter denne uken'}>
              {weekCount > 0 ? (
                <View style={styles.flame}>
                  <Icon name="flame.fill" size={22} color={STREAK_ORANGE} fallback="🔥" />
                  <ThemedText style={styles.flameCount}>{weekCount}</ThemedText>
                </View>
              ) : (
                <View style={[styles.empty, { borderColor: theme.backgroundSelected }]} />
              )}
            </View>
          </View>
        );
      })}

      <View style={[styles.footer, { borderTopColor: theme.backgroundSelected }]}>
        <View style={styles.flame}>
          <Icon name="flame.fill" size={20} color={streak > 0 ? STREAK_ORANGE : theme.backgroundSelected} fallback="🔥" />
        </View>
        <ThemedText style={styles.footerLabel}>Din streak</ThemedText>
        <ThemedText style={styles.footerValue}>
          {streak} {streak === 1 ? 'uke' : 'uker'}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two },
  title: { fontSize: 18, fontWeight: 700 },
  nav: { flexDirection: 'row', gap: Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12 },
  cell: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 16, fontVariant: ['tabular-nums'] },
  dayTextBold: { fontWeight: 700 },
  streakCol: { width: 40, alignItems: 'center', justifyContent: 'center', height: 42 },
  streakHead: { height: 20 },
  flame: { alignItems: 'center', justifyContent: 'center' },
  flameCount: { position: 'absolute', top: 6, color: '#FFFFFF', fontSize: 10, lineHeight: 12, fontWeight: 800 },
  empty: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  footerLabel: { flex: 1, fontWeight: 600 },
  footerValue: { fontWeight: 700, fontVariant: ['tabular-nums'] },
});
