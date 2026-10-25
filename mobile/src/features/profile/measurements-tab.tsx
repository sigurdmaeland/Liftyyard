import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { LineChart } from '@/components/line-chart';
import { ThemedText } from '@/components/themed-text';
import { SectionCard, Segmented } from '@/features/profile/section-card';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber } from '@/lib/format';
import { CHANGE_WINDOWS, latest, weighInDays, weightChange } from '@/lib/profile-stats';
import { getGoalWeight, listMeasurements } from '@/storage/measurement-store';
import { Radius, Spacing } from '@/theme';
import { BODY_PART_KINDS, MEASUREMENT_LABELS, type Measurement, type MeasurementKind, measurementUnit, toMeasurementDisplay } from '@/types/measurement';
import { toDisplay, unitLabel } from '@/lib/units';

type Range = '3m' | '6m' | '1y' | 'all';
const RANGES: { value: Range; label: string }[] = [
  { value: '3m', label: '3 mnd' },
  { value: '6m', label: '6 mnd' },
  { value: '1y', label: '1 år' },
  { value: 'all', label: 'Alt' },
];
const RANGE_MONTHS: Record<Range, number | null> = { '3m': 3, '6m': 6, '1y': 12, all: null };

const load = async (db: SQLiteDatabase) => ({ measurements: await listMeasurements(db), goal: await getGoalWeight(db) });

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
// Kroppsvekt lagres i kg og vises i valgt enhet. Grafen får verdiene ferdig omregnet, derav to varianter.
const weight = (kgValue: number) => `${formatNumber(toDisplay(kgValue), 1)} ${unitLabel()}`;
const plain = (shown: number) => `${formatNumber(shown, 1)} ${unitLabel()}`;
const signed = (kgDelta: number) => {
  const v = toDisplay(kgDelta);
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${formatNumber(Math.abs(v), 1)} ${unitLabel()}`;
};

const addMeasurement = (kind: MeasurementKind) => router.push({ pathname: '/measurements/add', params: { kind } });
const openKind = (kind: MeasurementKind) => router.push({ pathname: '/measurements/[kind]', params: { kind } });

/** Målinger: vekt med mål og utvikling, kroppsmål og andre målinger. Alt lagres lokalt og synkes. */
export function MeasurementsTab() {
  const theme = useTheme();
  const { state } = useLocalQuery(load);
  const [range, setRange] = useState<Range>('3m');
  const all = useMemo(() => (state.status === 'ready' ? state.data.measurements : []), [state]);
  const goal = state.status === 'ready' ? state.data.goal : null;

  const byKind = useMemo(() => {
    const map = new Map<MeasurementKind, Measurement[]>();
    for (const m of all) map.set(m.kind, [...(map.get(m.kind) ?? []), m]);
    return map;
  }, [all]);
  const weights = useMemo(() => byKind.get('WEIGHT') ?? [], [byKind]);
  const current = latest(weights);
  const days = useMemo(() => weighInDays(weights), [weights]);

  const chartPoints = useMemo(() => {
    const months = RANGE_MONTHS[range];
    const from = new Date();
    if (months !== null) from.setMonth(from.getMonth() - months);
    return weights
      .filter((m) => months === null || new Date(m.measuredAt).getTime() >= from.getTime())
      .map((m) => ({ date: m.measuredAt, value: toDisplay(m.value) }));
  }, [weights, range]);

  const latestOf = (kind: MeasurementKind) => latest(byKind.get(kind) ?? []);

  return (
    <View style={styles.wrap}>
      <SectionCard>
        <Pressable onPress={() => openKind('WEIGHT')} accessibilityRole="button" style={styles.weightRow}>
          <View style={styles.flex}>
            <ThemedText type="small" themeColor="textSecondary">
              Nåværende vekt
            </ThemedText>
            <ThemedText style={styles.big}>{current ? weight(current.value) : `— ${unitLabel()}`}</ThemedText>
            {goal !== null && (
              <ThemedText type="small" themeColor="textSecondary">
                Mål: {weight(goal)}
                {current ? ` · ${weight(Math.abs(current.value - goal))} ${current.value > goal ? 'igjen ned' : current.value < goal ? 'igjen opp' : '– nådd!'}` : ''}
              </ThemedText>
            )}
          </View>
          <Pressable
            onPress={() => router.push('/measurements/goal')}
            accessibilityRole="button"
            style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
            <Icon name={goal === null ? 'plus' : 'target'} size={14} color={theme.text} fallback="+" />
            <ThemedText type="smallBold">{goal === null ? 'Sett mål' : 'Endre mål'}</ThemedText>
          </Pressable>
        </Pressable>
      </SectionCard>

      <SectionCard title="Innveiing" subtitle="Siste 30 dager">
        <View style={styles.dots} accessible accessibilityLabel={`${days.filter(Boolean).length} innveiinger de siste 30 dagene`}>
          {[0, 1, 2].map((r) => (
            <View key={r} style={styles.dotRow}>
              {days.slice(r * 10, r * 10 + 10).map((has, c) => {
                const isToday = r * 10 + c === days.length - 1;
                return (
                  <View
                    key={c}
                    style={[
                      styles.dot,
                      has ? { backgroundColor: theme.accentFill } : { borderWidth: 1.5, borderColor: isToday ? theme.text : theme.backgroundSelected },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
        <Pressable onPress={() => addMeasurement('WEIGHT')} accessibilityRole="button" style={[styles.primary, { backgroundColor: theme.text }]}>
          <Icon name="plus" size={16} color={theme.background} fallback="+" />
          <ThemedText style={[styles.primaryLabel, { color: theme.background }]}>Registrer vekt</ThemedText>
        </Pressable>
      </SectionCard>

      <SectionCard title="Vektfremgang">
        {chartPoints.length === 0 ? (
          <View style={styles.emptyChart}>
            <Icon name="chart.xyaxis.line" size={28} color={theme.textSecondary} fallback="📈" />
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              Ingen data ennå. Registrer vekten din for å se utviklingen.
            </ThemedText>
          </View>
        ) : (
          <LineChart points={chartPoints} height={190} noun="målinger" format={plain} formatDate={shortDate} />
        )}
        <Segmented options={RANGES} value={range} onChange={setRange} />
      </SectionCard>

      <SectionCard title="Vektendringer">
        <View>
          {[...CHANGE_WINDOWS, null].map((d, i) => {
            const change = weightChange(weights, d);
            return (
              <View key={i} style={[styles.changeRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
                <ThemedText style={styles.flex}>{d === null ? 'Hele perioden' : `${d} dager`}</ThemedText>
                <ThemedText style={styles.changeValue} themeColor={change === null ? 'textSecondary' : 'text'}>
                  {change === null ? '—' : signed(change)}
                </ThemedText>
              </View>
            );
          })}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Krever minst to innveiinger i perioden.
        </ThemedText>
      </SectionCard>

      <View style={styles.sectionHeader}>
        <ThemedText accessibilityRole="header" style={styles.sectionTitle}>Kroppsmål</ThemedText>
        <Pressable onPress={() => router.push('/measurements')} hitSlop={8} accessibilityRole="button">
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            Se alle
          </ThemedText>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.cards}>
        {BODY_PART_KINDS.map((kind) => {
          const m = latestOf(kind);
          return (
            <Pressable
              key={kind}
              onPress={() => (m ? openKind(kind) : addMeasurement(kind))}
              accessibilityRole="button"
              style={[styles.partCard, { backgroundColor: theme.card }]}>
              <ThemedText style={styles.partName} numberOfLines={2}>
                {MEASUREMENT_LABELS[kind]}
              </ThemedText>
              {m ? (
                <>
                  <ThemedText style={styles.partValue}>
                    {formatNumber(toMeasurementDisplay(kind, m.value), 1)} {measurementUnit(kind)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {shortDate(m.measuredAt)}
                  </ThemedText>
                </>
              ) : (
                <View style={styles.addRow}>
                  <Icon name="plus.circle.fill" size={18} color={theme.accent} fallback="+" />
                  <ThemedText type="smallBold" style={{ color: theme.accent }}>
                    Legg til måling
                  </ThemedText>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <ThemedText accessibilityRole="header" style={styles.sectionTitle}>Andre målinger</ThemedText>
      <View style={[styles.list, { backgroundColor: theme.card }]}>
        {(['BODY_FAT', 'HEIGHT'] as const).map((kind, i) => {
          const m = latestOf(kind);
          return (
            <Pressable
              key={kind}
              onPress={() => (m ? openKind(kind) : addMeasurement(kind))}
              accessibilityRole="button"
              style={[styles.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
              <Icon name={kind === 'HEIGHT' ? 'ruler' : 'percent'} size={20} color={theme.textSecondary} fallback="•" />
              <ThemedText style={styles.flex}>{MEASUREMENT_LABELS[kind]}</ThemedText>
              <ThemedText themeColor={m ? 'text' : 'textSecondary'}>
                {m ? `${formatNumber(m.value, 1)} ${measurementUnit(kind)}` : 'Legg til'}
              </ThemedText>
              <Icon name="chevron.right" size={14} color={theme.textSecondary} fallback="›" />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  flex: { flex: 1 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  big: { fontSize: 34, lineHeight: 40, fontWeight: 700, fontVariant: ['tabular-nums'] },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.three, minHeight: 44, borderRadius: 17 },
  dots: { gap: 10 },
  dotRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 22, height: 22, borderRadius: 11 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 22 },
  primaryLabel: { fontWeight: 700 },
  emptyChart: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  centerText: { textAlign: 'center' },
  changeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  changeValue: { fontWeight: 600, fontVariant: ['tabular-nums'] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.two },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: 700 },
  bleed: { marginHorizontal: -Spacing.four },
  cards: { gap: Spacing.three, paddingHorizontal: Spacing.four },
  partCard: { width: 140, height: 110, borderRadius: Radius.large, padding: Spacing.three, justifyContent: 'space-between' },
  partName: { fontWeight: 600, lineHeight: 20 },
  partValue: { fontSize: 22, lineHeight: 28, fontWeight: 700, fontVariant: ['tabular-nums'] },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  list: { borderRadius: Radius.large, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, minHeight: 52 },
});
