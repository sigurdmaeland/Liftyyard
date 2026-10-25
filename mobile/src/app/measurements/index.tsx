import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber } from '@/lib/format';
import { latest } from '@/lib/profile-stats';
import { listMeasurements } from '@/storage/measurement-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';
import { BODY_PART_KINDS, MEASUREMENT_LABELS, type Measurement, type MeasurementKind, measurementUnit, toMeasurementDisplay } from '@/types/measurement';

const GROUPS: { title: string; kinds: MeasurementKind[] }[] = [
  { title: 'Kropp', kinds: ['WEIGHT', 'BODY_FAT', 'HEIGHT'] },
  { title: 'Kroppsmål', kinds: BODY_PART_KINDS },
];

const load = (db: Parameters<typeof listMeasurements>[0]) => listMeasurements(db);

/** Alle typer målinger med siste verdi. */
export default function AllMeasurementsScreen() {
  const theme = useTheme();
  const { state } = useLocalQuery(load);
  const latestByKind = useMemo(() => {
    const map = new Map<MeasurementKind, Measurement[]>();
    for (const m of state.status === 'ready' ? state.data : []) map.set(m.kind, [...(map.get(m.kind) ?? []), m]);
    return new Map([...map].map(([k, v]) => [k, latest(v)]));
  }, [state]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: theme.backgroundGrouped }} contentContainerStyle={styles.content}>
      {GROUPS.map((g) => (
        <View key={g.title} style={styles.group}>
          <ThemedText accessibilityRole="header" type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
            {g.title}
          </ThemedText>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {g.kinds.map((kind, i) => {
              const m = latestByKind.get(kind);
              return (
                <Pressable
                  key={kind}
                  onPress={() => router.push({ pathname: '/measurements/[kind]', params: { kind } })}
                  accessibilityRole="button"
                  style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
                  <ThemedText style={styles.flex}>{MEASUREMENT_LABELS[kind]}</ThemedText>
                  <ThemedText themeColor={m ? 'text' : 'textSecondary'} style={styles.value}>
                    {m ? `${formatNumber(toMeasurementDisplay(kind, m.value), 1)} ${measurementUnit(kind)}` : '—'}
                  </ThemedText>
                  <Icon name="chevron.right" size={14} color={theme.textSecondary} fallback="›" />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  group: { gap: Spacing.two },
  groupTitle: { textTransform: 'uppercase', marginLeft: Spacing.three },
  card: { borderRadius: Radius.large, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 50 },
  flex: { flex: 1 },
  value: { fontVariant: ['tabular-nums'] },
});
