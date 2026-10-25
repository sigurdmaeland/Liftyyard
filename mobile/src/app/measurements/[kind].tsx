import { Stack, router, useLocalSearchParams } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { LineChart } from '@/components/line-chart';
import { ThemedText } from '@/components/themed-text';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber } from '@/lib/format';
import { syncPendingWorkouts } from '@/services/sync';
import { deleteMeasurement, listMeasurements } from '@/storage/measurement-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';
import { MEASUREMENT_LABELS, type Measurement, isMeasurementKind, measurementUnit, toMeasurementDisplay } from '@/types/measurement';

/** Historikk for én type måling: graf og liste. Trykk på en måling for å slette den. */
export default function MeasurementHistoryScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const db = useSQLiteContext();
  const theme = useTheme();
  const valid = isMeasurementKind(kind);
  const query = useCallback((d: SQLiteDatabase) => (valid ? listMeasurements(d, kind) : Promise.resolve([])), [kind, valid]);
  const { state, reload } = useLocalQuery(query);
  const entries = state.status === 'ready' ? state.data : [];

  if (!valid) return null;
  const unit = measurementUnit(kind);
  const fmt = (v: number) => `${formatNumber(v, 1)} ${unit}`;
  const shown = (m: { value: number }) => toMeasurementDisplay(kind, m.value);

  const confirmDelete = (m: Measurement) =>
    Alert.alert('Slette målingen?', `${fmt(shown(m))} – ${new Date(m.measuredAt).toLocaleDateString('nb-NO')}`, [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Slett',
        style: 'destructive',
        onPress: async () => {
          await deleteMeasurement(db, m.id);
          syncPendingWorkouts(db).catch(() => {});
          reload();
        },
      },
    ]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: theme.backgroundGrouped }} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: MEASUREMENT_LABELS[kind],
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/measurements/add', params: { kind } })}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Legg til måling">
              <Icon name="plus" color={theme.text} fallback="+" />
            </Pressable>
          ),
        }}
      />
      {entries.length > 0 && (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <LineChart
            points={entries.map((m) => ({ date: m.measuredAt, value: shown(m) }))}
            height={200}
            noun="målinger"
            format={fmt}
            formatDate={(iso) => new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
          />
        </View>
      )}
      {state.status === 'ready' && entries.length === 0 && (
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          Ingen målinger ennå. Trykk + for å legge til.
        </ThemedText>
      )}
      {entries.length > 0 && (
        <View style={[styles.card, styles.list, { backgroundColor: theme.card }]}>
          {[...entries].reverse().map((m, i) => (
            <Pressable
              key={m.id}
              onPress={() => confirmDelete(m)}
              accessibilityRole="button"
              accessibilityHint="Slett målingen"
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
              <ThemedText style={styles.flex}>
                {new Date(m.measuredAt).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
              </ThemedText>
              <ThemedText style={styles.value}>{fmt(shown(m))}</ThemedText>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  card: { borderRadius: Radius.large, padding: Spacing.three },
  list: { paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 50 },
  flex: { flex: 1 },
  value: { fontWeight: 600, fontVariant: ['tabular-nums'] },
  empty: { textAlign: 'center', marginTop: Spacing.five },
});
