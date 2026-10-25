import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LineChart } from '@/components/line-chart';
import { ThemedText } from '@/components/themed-text';
import { SectionCard, Segmented } from '@/features/profile/section-card';
import { formatVolume } from '@/lib/format';
import { type Metric, weeklySeries } from '@/lib/profile-stats';
import { formatShortDuration } from '@/lib/stats';
import type { Workout } from '@/types/workout';

const METRICS: { value: Metric; label: string }[] = [
  { value: 'duration', label: 'Varighet' },
  { value: 'volume', label: 'Volum' },
  { value: 'workouts', label: 'Treninger' },
];

function formatMetric(metric: Metric, v: number): string {
  if (metric === 'duration') return formatShortDuration(v);
  if (metric === 'volume') return formatVolume(v);
  return `${Math.round(v)} ${Math.round(v) === 1 ? 'økt' : 'økter'}`;
}

function formatAxis(metric: Metric, v: number): string {
  if (metric === 'duration') return `${Math.round(v / 3600)}t`;
  if (metric === 'volume') return v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v));
  return String(Math.round(v));
}

const weekLabel = (iso: string) =>
  `Uke fra ${new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}`;

/** «Denne uka»: ukens tall som overskrift og en graf per uke for varighet, volum eller treninger. */
export function WeeklyChartCard({ workouts, from }: { workouts: Pick<Workout, 'startedAt' | 'endedAt' | 'exercises'>[]; from: Date }) {
  const [metric, setMetric] = useState<Metric>('duration');
  const series = useMemo(() => weeklySeries(workouts, metric, from), [workouts, metric, from]);
  const thisWeek = series[series.length - 1]?.value ?? 0;

  return (
    <SectionCard>
      <View>
        <ThemedText type="small" themeColor="textSecondary">
          Denne uka
        </ThemedText>
        <ThemedText style={styles.headline}>{formatMetric(metric, thisWeek)}</ThemedText>
      </View>
      {workouts.length === 0 ? (
        <ThemedText themeColor="textSecondary">Fullfør en økt for å se utviklingen uke for uke.</ThemedText>
      ) : (
        <LineChart
          points={series}
          height={180}
          area
          noun="uker"
          format={(v) => formatMetric(metric, v)}
          formatAxis={(v) => formatAxis(metric, v)}
          formatDate={weekLabel}
        />
      )}
      <Segmented options={METRICS} value={metric} onChange={setMetric} variant="chips" />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  headline: { fontSize: 34, lineHeight: 41, fontWeight: 700, fontVariant: ['tabular-nums'] },
});
