import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BodyFigure } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { RecordChip } from '@/features/workout-view/medals';
import { useCatalog } from '@/hooks/use-catalog';
import { useTheme } from '@/hooks/use-theme';
import { exerciseFigure } from '@/lib/categories';
import { formatNumber } from '@/lib/format';
import { type SetRecord, estimateOneRepMax } from '@/lib/records';
import { describeSet, setLabels } from '@/lib/set-fields';
import { Radius, Spacing } from '@/theme';
import { type ExerciseType, SET_TYPE_NAMES, type SetType } from '@/types/workout';
import { toDisplay, unitLabel } from '@/lib/units';

export type ViewSet = {
  id: string;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
  completedAt: string | null;
};
export type ViewExercise = {
  id: string;
  exerciseId: string | null;
  exerciseName: string;
  exerciseType: string;
  notes: string | null;
  sets: ViewSet[];
  supersetGroup?: number | null;
};

const usesWeight = (t: string) => t === 'WEIGHT_REPS' || t === 'WEIGHTED_BODYWEIGHT';

/**
 * Én øvelse i en fullført økt: bilde, navn, antall sett og en tabell med SETT, resultat og
 * estimert 1RM. Rekorder vises som medaljer under settet. Bare fullførte sett tas med.
 */
export function ExerciseSets({ exercise: e, records }: { exercise: ViewExercise; records?: Map<string, SetRecord[]> }) {
  const theme = useTheme();
  const catalog = useCatalog();
  const sets = e.sets.filter((s) => s.completedAt);
  const labels = setLabels(sets);
  const ex = e.exerciseId ? catalog.get(e.exerciseId) : undefined;
  const figure = ex ? exerciseFigure(ex) : null;
  const showOneRm = usesWeight(e.exerciseType);
  const type = e.exerciseType as ExerciseType;

  return (
    <View style={styles.exercise}>
      <Pressable
        onPress={() => e.exerciseId && router.push({ pathname: '/exercise/[id]', params: { id: e.exerciseId } })}
        disabled={!e.exerciseId}
        accessibilityRole="button"
        accessibilityLabel={`${e.exerciseName}, ${sets.length} sett`}
        accessibilityHint="Åpner øvelsen"
        style={styles.header}>
        <View style={[styles.thumb, { backgroundColor: theme.tile }]}>
          {figure ? (
            <BodyFigure side={figure.side} load={figure.load} height={56} crop="upper" />
          ) : (
            <Icon name="dumbbell.fill" color={theme.textSecondary} fallback="•" />
          )}
        </View>
        <View style={styles.headerText}>
          <ThemedText style={styles.name} numberOfLines={2}>
            {e.exerciseName}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {sets.length} sett{e.supersetGroup ? ' · Supersett' : ''}
          </ThemedText>
        </View>
      </Pressable>
      {e.notes && (
        <ThemedText type="small" themeColor="textSecondary">
          {e.notes}
        </ThemedText>
      )}

      <View style={styles.tableHead} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ThemedText type="small" themeColor="textSecondary" style={[styles.colSet, styles.caps]}>
          Sett
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={[styles.flex, styles.caps]}>
          {showOneRm ? 'Vekt og reps' : 'Resultat'}
        </ThemedText>
        {showOneRm && (
          <ThemedText type="small" themeColor="textSecondary" style={[styles.colRm, styles.caps]}>
            1RM
          </ThemedText>
        )}
      </View>
      {sets.map((s, i) => {
        const rm = showOneRm ? estimateOneRepMax(s.weightKg, s.reps) : null;
        const recs = records?.get(s.id) ?? [];
        const result = describeSet(type, s, (n) => formatNumber(n)).replace('×', `${unitLabel()} ×`);
        const labelColor = s.setType === 'WARMUP' ? theme.textSecondary : theme.accent;
        return (
          <View
            key={s.id}
            accessible
            accessibilityLabel={[
              `Sett ${labels[i]}${s.setType !== 'NORMAL' ? `, ${SET_TYPE_NAMES[s.setType]}` : ''}`,
              result,
              rm ? `estimert 1RM ${Math.round(toDisplay(rm))} ${unitLabel() === 'kg' ? 'kilo' : 'pund'}` : '',
              recs.length > 0 ? `${recs.length} ${recs.length === 1 ? 'rekord' : 'rekorder'}` : '',
            ]
              .filter(Boolean)
              .join(', ')}
            style={[styles.row, i % 2 === 1 && { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={[styles.colSet, styles.setLabel, { color: labelColor }]}>{labels[i]}</ThemedText>
            <View style={styles.flex}>
              <ThemedText style={styles.result}>{result || '–'}</ThemedText>
              {recs.length > 0 && (
                <View style={styles.chips}>
                  {recs.map((r) => (
                    <RecordChip key={r.kind} record={r} />
                  ))}
                </View>
              )}
            </View>
            {showOneRm && <ThemedText style={[styles.colRm, styles.rm]}>{rm ? Math.round(toDisplay(rm)) : '–'}</ThemedText>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  exercise: { gap: Spacing.two, marginBottom: Spacing.four },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  thumb: { width: 64, height: 64, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  headerText: { flex: 1, gap: 2 },
  name: { fontSize: 18, lineHeight: 24, fontWeight: 700 },
  tableHead: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.two, marginHorizontal: -Spacing.four, paddingHorizontal: Spacing.four + Spacing.three },
  caps: { textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    marginHorizontal: -Spacing.four,
    paddingHorizontal: Spacing.four + Spacing.three,
  },
  colSet: { width: 56 },
  colRm: { width: 56, textAlign: 'right' },
  flex: { flex: 1, gap: 4 },
  setLabel: { fontSize: 18, fontWeight: 700 },
  result: { fontSize: 18, fontWeight: 600, fontVariant: ['tabular-nums'] },
  rm: { fontSize: 18, fontWeight: 600, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
});
