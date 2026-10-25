import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SET_ROW_COLUMNS, SetRow } from '@/features/workout/set-row';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber } from '@/lib/format';
import { describeSet, fieldsFor, setLabels, suggestionFor } from '@/lib/set-fields';
import { addSet, getPreviousSets, setExerciseNotes } from '@/storage/workout-store';
import { Radius, Spacing } from '@/theme';
import type { PreviousSet, WorkoutExercise } from '@/types/workout';

type Props = {
  workoutId: string;
  exercise: WorkoutExercise;
  /** False for øvelser midt i et supersett: da hviler man ikke før neste øvelse. */
  restAfterSet?: boolean;
  onChanged: () => void;
};

/** Settabellen for én øvelse i den aktive økten: notat, kolonner, sett og «Legg til sett». */
export function SetsEditor({ workoutId, exercise, restAfterSet = true, onChanged }: Props) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [previous, setPrevious] = useState<PreviousSet[]>([]);
  const [notes, setNotes] = useState(exercise.notes ?? '');

  useEffect(() => {
    let active = true;
    getPreviousSets(db, exercise.exerciseId, workoutId)
      .then((p) => active && setPrevious(p))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [db, exercise.exerciseId, workoutId]);

  const labels = setLabels(exercise.sets);
  const fields = fieldsFor(exercise.exerciseType);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <TextInput
        value={notes}
        onChangeText={(t) => {
          setNotes(t);
          setExerciseNotes(db, exercise.id, t).catch(() => {});
        }}
        placeholder="Notat for øvelsen"
        accessibilityLabel="Notat for øvelsen"
        placeholderTextColor={theme.textSecondary}
        style={[styles.notes, { color: theme.text }]}
        multiline
      />

      <View style={styles.columns}>
        <ThemedText type="small" themeColor="textSecondary" style={{ width: SET_ROW_COLUMNS.label, textAlign: 'center' }}>
          Sett
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ width: SET_ROW_COLUMNS.previous }}>
          Forrige
        </ThemedText>
        {fields.map((f) => (
          <ThemedText key={f.key} type="small" themeColor="textSecondary" style={styles.fieldHeader}>
            {f.label}
          </ThemedText>
        ))}
        <View style={{ width: SET_ROW_COLUMNS.check }} />
      </View>

      {exercise.sets.map((s, i) => (
        <SetRow
          key={`${s.id}:${s.completedAt ?? ''}`}
          workoutId={workoutId}
          exerciseType={exercise.exerciseType}
          set={s}
          label={labels[i]}
          previousText={previous[i] ? describeSet(exercise.exerciseType, previous[i], (n) => formatNumber(n)) : ''}
          suggestion={suggestionFor(i, exercise.sets, previous)}
          startsRest={restAfterSet}
          onChanged={onChanged}
        />
      ))}

      <Pressable
        onPress={() => addSet(db, workoutId, exercise.id).then(onChanged)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.addSet, { backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}>
        <ThemedText type="smallBold">+ Legg til sett</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  notes: { fontSize: 14, paddingVertical: 0 },
  columns: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.one },
  fieldHeader: { flex: 1, textAlign: 'center' },
  addSet: { minHeight: 44, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.one },
});
