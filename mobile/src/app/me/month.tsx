import { Stack } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ShareCard, type ShareCardRef } from '@/features/share/share-card';
import { shareViewAsImage } from '@/features/share/share-image';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { formatVolume } from '@/lib/format';
import { monthName, monthSummary } from '@/lib/month';
import { formatShortDuration } from '@/lib/stats';
import { listFinishedWorkoutsDetailed } from '@/storage/workout-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';

/** Månedsoppsummering: økter, tid, volum, rekorder og mest brukte øvelser – og et bilde å dele. */
export default function MonthScreen() {
  const theme = useTheme();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const { state } = useLocalQuery(listFinishedWorkoutsDetailed);
  const card = useRef<ShareCardRef>(null);
  const summary = useMemo(
    () => (state.status === 'ready' ? monthSummary(state.data, cursor.year, cursor.month) : null),
    [state, cursor],
  );
  const isCurrent = cursor.year === now.getFullYear() && cursor.month === now.getMonth();
  const move = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const title = monthName(cursor.year, cursor.month);

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Månedsoppsummering' }} />
      <View style={styles.nav}>
        <Pressable onPress={() => move(-1)} accessibilityRole="button" accessibilityLabel="Forrige måned" style={styles.navButton}>
          <Icon name="chevron.left" color={theme.text} fallback="‹" />
        </Pressable>
        <ThemedText accessibilityRole="header" style={styles.month}>
          {title}
        </ThemedText>
        <Pressable
          onPress={() => move(1)}
          disabled={isCurrent}
          accessibilityRole="button"
          accessibilityLabel="Neste måned"
          accessibilityState={{ disabled: isCurrent }}
          style={[styles.navButton, { opacity: isCurrent ? 0.3 : 1 }]}>
          <Icon name="chevron.right" color={theme.text} fallback="›" />
        </Pressable>
      </View>

      {summary && summary.workouts === 0 ? (
        <EmptyState icon="calendar" title="Ingen økter denne måneden" text="Økter du fullfører havner i oppsummeringen." />
      ) : summary ? (
        <>
          <View style={styles.cardWrap}>
            <ShareCard
              ref={card}
              eyebrow="Måneden min"
              title={title}
              stats={[
                { label: 'Økter', value: String(summary.workouts) },
                { label: 'Tid', value: formatShortDuration(summary.seconds) },
                { label: 'Volum', value: formatVolume(summary.volumeKg) },
                ...(summary.records > 0 ? [{ label: 'Rekorder', value: `🏅 ${summary.records}` }] : []),
              ]}
              lines={summary.topExercises.map((e) => `${e.name} · ${e.workouts} ${e.workouts === 1 ? 'økt' : 'økter'}`)}
            />
          </View>
          <Button label="Del bilde" onPress={() => shareViewAsImage(card, title)} />

          <View style={[styles.grid, { backgroundColor: theme.backgroundElement }]}>
            <Fact label="Treningsdager" value={String(summary.activeDays)} />
            <Fact label="Sett" value={String(summary.sets)} />
            <Fact label="Snitt per økt" value={formatShortDuration(summary.seconds / summary.workouts)} />
            <Fact label="Rekorder" value={String(summary.records)} />
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}: ${value}`}>
      <ThemedText style={styles.factValue}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  month: { fontSize: 22, lineHeight: 28, fontWeight: 700 },
  cardWrap: { alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: Radius.large, padding: Spacing.three },
  fact: { width: '50%', paddingVertical: Spacing.two, gap: 2 },
  factValue: { fontSize: 22, lineHeight: 28, fontWeight: 800, fontVariant: ['tabular-nums'] },
});
