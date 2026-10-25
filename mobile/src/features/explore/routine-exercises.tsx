import { StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/theme';
import type { RemoteRoutine } from '@/types/explore';
import { formatWeight } from '@/lib/units';

type Exercises = RemoteRoutine['exercises'];

function target(s: Exercises[number]['sets'][number] | undefined): string {
  if (!s) return '–';
  if (s.targetDurationSeconds) return `${s.targetDurationSeconds} s`;
  const reps = s.targetReps ?? '–';
  return s.targetWeightKg ? `${reps} × ${formatWeight(s.targetWeightKg)}` : `${reps} reps`;
}

/** Øvelsene i en delt rutine: navn, antall sett og målet for første sett. */
export function RoutineExercises({ exercises }: { exercises: Exercises }) {
  const theme = useTheme();
  if (exercises.length === 0) {
    return <ThemedText themeColor="textSecondary">Ingen øvelser ennå.</ThemedText>;
  }
  return (
    <View style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
      {exercises.map((e, i) => (
        <View key={e.id} style={[styles.row, i > 0 && { borderTopColor: theme.backgroundSelected, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={styles.flex}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {e.exerciseName}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {e.sets.length} sett · {target(e.sets[0])}
              {e.restSeconds ? ` · ${e.restSeconds} s pause` : ''}
            </ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
}

export function Fact({ icon, text }: { icon: SFSymbol; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={16} color={theme.textSecondary} fallback="•" />
      <ThemedText type="small" themeColor="textSecondary">
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: Radius.large, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.three },
  flex: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: 600 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
