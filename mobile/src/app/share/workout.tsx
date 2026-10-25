import { Stack, useLocalSearchParams } from 'expo-router';
import { type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ShareCard, type ShareCardRef } from '@/features/share/share-card';
import { shareViewAsImage } from '@/features/share/share-image';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { formatVolume } from '@/lib/format';
import { computeTotals } from '@/lib/metrics';
import { formatShortDuration, recordsPerWorkout } from '@/lib/stats';
import { getWorkout, listFinishedWorkoutsDetailed } from '@/storage/workout-store';
import { Spacing } from '@/theme';

/** Forhåndsvisning av delingsbildet for en av dine økter, med «Del bilde». */
export default function ShareWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const card = useRef<ShareCardRef>(null);
  const query = useCallback(
    async (db: SQLiteDatabase) => ({ workout: await getWorkout(db, id), records: recordsPerWorkout(await listFinishedWorkoutsDetailed(db)).get(id) ?? 0 }),
    [id],
  );
  const { state } = useLocalQuery(query);
  const w = state.status === 'ready' ? state.data.workout : null;
  const totals = w ? computeTotals(w.exercises) : null;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Del økten' }} />
      {w && totals && (
        <>
          <ShareCard
            ref={card}
            eyebrow={new Date(w.startedAt).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}
            title={w.name}
            stats={[
              { label: 'Varighet', value: formatShortDuration((new Date(w.endedAt ?? w.startedAt).getTime() - new Date(w.startedAt).getTime()) / 1000) },
              { label: 'Volum', value: formatVolume(totals.volumeKg) },
              { label: 'Sett', value: String(totals.completedSetCount) },
              ...(state.status === 'ready' && state.data.records > 0 ? [{ label: 'Rekorder', value: `🏅 ${state.data.records}` }] : []),
            ]}
            lines={w.exercises
              .filter((e) => e.sets.some((s) => s.completedAt))
              .slice(0, 6)
              .map((e) => `${e.sets.filter((s) => s.completedAt).length} × ${e.exerciseName}`)}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Bildet viser ikke private notater eller bilder.
          </ThemedText>
          <Button label="Del bilde" onPress={() => shareViewAsImage(card, w.name)} style={styles.button} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three, alignItems: 'center' },
  center: { textAlign: 'center' },
  button: { alignSelf: 'stretch' },
});
