import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BodyMap } from '@/components/body-map';
import { ThemedText } from '@/components/themed-text';
import { MonthCalendar } from '@/features/profile/month-calendar';
import { RadarChart } from '@/features/profile/radar-chart';
import { WeeklyChartCard } from '@/features/profile/weekly-chart-card';
import { SectionCard, Segmented } from '@/features/profile/section-card';
import { formatVolume } from '@/lib/format';
import { muscleLoad } from '@/lib/muscles';
import { type Period, muscleDistribution, periodStart } from '@/lib/profile-stats';
import { startOfWeek } from '@/lib/stats';
import { Spacing } from '@/theme';
import type { Exercise, Workout } from '@/types/workout';

const PERIODS: { value: Period; label: string }[] = [
  { value: '3m', label: '3 mnd' },
  { value: '6m', label: '6 mnd' },
  { value: '1y', label: 'År' },
  { value: 'all', label: 'Alle' },
];

type RadarMetric = 'sets' | 'volume';

/** Oversikt: ukentlig utvikling, muskler denne uka, kalender med ukesrekke og muskelfordeling. */
export function OverviewTab({ workouts, catalog }: { workouts: Workout[]; catalog: Exercise[] }) {
  const [period, setPeriod] = useState<Period>('3m');
  const [radarMetric, setRadarMetric] = useState<RadarMetric>('sets');

  const earliest = workouts.length > 0 ? workouts[workouts.length - 1].startedAt : undefined;
  const from = useMemo(() => periodStart(period, new Date(), earliest), [period, earliest]);

  const weekLoad = useMemo(() => {
    const monday = startOfWeek(new Date()).getTime();
    const exercises = workouts.filter((w) => new Date(w.startedAt).getTime() >= monday).flatMap((w) => w.exercises);
    return muscleLoad(exercises, catalog);
  }, [workouts, catalog]);

  const distribution = useMemo(() => muscleDistribution(workouts, catalog, from), [workouts, catalog, from]);

  return (
    <View style={styles.wrap}>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />

      <WeeklyChartCard workouts={workouts} from={from} />

      <SectionCard title="Denne uka" subtitle="Se hvilke muskler du trente">
        {weekLoad.size === 0 ? (
          <ThemedText themeColor="textSecondary">Ingen fullførte sett denne uka ennå.</ThemedText>
        ) : (
          <View style={styles.center}>
            <BodyMap load={weekLoad} height={220} />
          </View>
        )}
      </SectionCard>

      <SectionCard>
        <MonthCalendar workouts={workouts} />
      </SectionCard>

      <SectionCard title="Muskelfordeling" subtitle="Sett og volum på tvers av muskelgrupper">
        <RadarChart
          axes={distribution.map((g) => ({ label: g.label, value: radarMetric === 'sets' ? g.sets : g.volumeKg }))}
          format={(v) => (radarMetric === 'sets' ? `${v} sett` : formatVolume(v))}
        />
        <Segmented
          options={[
            { value: 'sets', label: 'Sett' },
            { value: 'volume', label: 'Volum' },
          ]}
          value={radarMetric}
          onChange={setRadarMetric}
          variant="chips"
        />
      </SectionCard>

      <SectionCard title="Treningslogg" subtitle="Se mønstre i øktene dine" onPress={() => router.push('/history')} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  center: { alignItems: 'center' },
});
