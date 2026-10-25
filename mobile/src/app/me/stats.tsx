import type { SQLiteDatabase } from 'expo-sqlite';
import { type ReactNode, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { formatVolume } from '@/lib/format';
import { heaviestLift, totalsSince, type Totals } from '@/lib/profile-stats';
import { formatShortDuration } from '@/lib/stats';
import { listFinishedWorkoutsDetailed } from '@/storage/workout-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';
import { formatWeight } from '@/lib/units';

/** De tre store løftene, med ID-ene fra den felles øvelseskatalogen (V3). */
const BIG_LIFTS = [
  { id: '01960000-0000-7000-8000-000000000001', label: 'Benkpress' },
  { id: '01960000-0000-7000-8000-000000000027', label: 'Knebøy' },
  { id: '01960000-0000-7000-8000-000000000013', label: 'Markløft' },
];

const load = (db: SQLiteDatabase) => listFinishedWorkoutsDetailed(db, 5000);

/** Statistikk: i år, hele tiden og beste løft (tyngste fullførte arbeidssett). */
export default function StatsScreen() {
  const theme = useTheme();
  const { state } = useLocalQuery(load);
  const data = useMemo(() => {
    const workouts = state.status === 'ready' ? state.data : [];
    return {
      year: totalsSince(workouts, new Date(new Date().getFullYear(), 0, 1)),
      all: totalsSince(workouts),
      lifts: BIG_LIFTS.map((l) => ({ ...l, kg: heaviestLift(workouts, l.id) })),
    };
  }, [state]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: theme.backgroundGrouped }} contentContainerStyle={styles.content}>
      <TotalsGroup title="I år" totals={data.year} />
      <TotalsGroup title="Hele tiden" totals={data.all} />
      <Group title="Beste løft (maks vekt)">
        {data.lifts.map((l, i) => (
          <Row key={l.id} label={l.label} value={l.kg === null ? '—' : formatWeight(l.kg)} divider={i > 0} />
        ))}
      </Group>
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        Beste løft er tyngste fullførte arbeidssett, uansett antall repetisjoner.
      </ThemedText>
    </ScrollView>
  );
}

function TotalsGroup({ title, totals }: { title: string; totals: Totals }) {
  return (
    <Group title={title}>
      <Row label="Treninger" value={String(totals.workouts)} />
      <Row label="Tid" value={formatShortDuration(totals.seconds)} divider />
      <Row label="Løftet vekt" value={formatVolume(totals.volumeKg)} divider />
    </Group>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <ThemedText accessibilityRole="header" type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
        {title}
      </ThemedText>
      <View style={[styles.card, { backgroundColor: theme.card }]}>{children}</View>
    </View>
  );
}

function Row({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
      <ThemedText style={styles.flex}>{label}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  group: { gap: Spacing.two },
  groupTitle: { textTransform: 'uppercase', marginLeft: Spacing.three },
  card: { borderRadius: Radius.large, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  flex: { flex: 1 },
  value: { fontVariant: ['tabular-nums'] },
  note: { textAlign: 'center' },
});
