import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber, parseDecimal, parseInteger } from '@/lib/format';
import { nextSetType, setLabels } from '@/lib/set-fields';
import {
  addRoutineSet,
  deleteRoutineSet,
  moveRoutineExercise,
  removeRoutineExercise,
  type RoutineSetField,
  setRoutineSetType,
  updateRoutineSetField,
} from '@/storage/program-store';
import { Radius, Spacing } from '@/theme';
import type { RoutineExercise, RoutineSet } from '@/types/program';
import type { ExerciseType } from '@/types/workout';
import { SET_TYPE_NAMES } from '@/types/workout';
import { fromDisplay, toDisplay, unitLabel } from '@/lib/units';

type Field = { key: RoutineSetField; label: string; decimal: boolean };

/** Målfeltene en rutine har per øvelsestype. */
function targetFields(type: ExerciseType): Field[] {
  switch (type) {
    case 'WEIGHT_REPS':
      return [
        { key: 'targetWeightKg', label: unitLabel(), decimal: true },
        { key: 'targetReps', label: 'reps', decimal: false },
      ];
    case 'WEIGHTED_BODYWEIGHT':
      return [
        { key: 'targetWeightKg', label: `+${unitLabel()}`, decimal: true },
        { key: 'targetReps', label: 'reps', decimal: false },
      ];
    case 'ASSISTED_BODYWEIGHT':
      return [
        { key: 'targetWeightKg', label: `−${unitLabel()}`, decimal: true },
        { key: 'targetReps', label: 'reps', decimal: false },
      ];
    case 'BODYWEIGHT_REPS':
      return [{ key: 'targetReps', label: 'reps', decimal: false }];
    case 'DURATION':
    case 'DISTANCE_DURATION':
      return [{ key: 'targetDurationSeconds', label: 'sek', decimal: false }];
  }
}

type Props = {
  routineId: string;
  exercise: RoutineExercise;
  isFirst: boolean;
  isLast: boolean;
  onChanged: () => void;
};

/** Én øvelse i rutine-editoren: navn, meny og tabell med målsett. */
export function RoutineExerciseEditor({ routineId, exercise, isFirst, isLast, onChanged }: Props) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const fields = targetFields(exercise.exerciseType);
  const labels = setLabels(exercise.sets);

  const openMenu = () => {
    Alert.alert(exercise.exerciseName, undefined, [
      ...(!isFirst ? [{ text: 'Flytt opp', onPress: () => moveRoutineExercise(db, routineId, exercise.id, -1).then(onChanged) }] : []),
      ...(!isLast ? [{ text: 'Flytt ned', onPress: () => moveRoutineExercise(db, routineId, exercise.id, 1).then(onChanged) }] : []),
      { text: 'Fjern fra rutinen', style: 'destructive' as const, onPress: () => removeRoutineExercise(db, exercise.id).then(onChanged) },
      { text: 'Avbryt', style: 'cancel' as const },
    ]);
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.header}>
        <View style={[styles.thumb, { backgroundColor: theme.background }]}>
          <Icon name="dumbbell.fill" size={20} color={theme.textSecondary} fallback="•" />
        </View>
        <ThemedText type="smallBold" style={styles.name} numberOfLines={2}>
          {exercise.exerciseName}
        </ThemedText>
        <Pressable onPress={openMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Valg for ${exercise.exerciseName}`}>
          <Icon name="ellipsis" color={theme.accent} fallback="⋯" />
        </Pressable>
      </View>

      <View style={styles.columns}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.labelCol}>
          Sett
        </ThemedText>
        {fields.map((f) => (
          <ThemedText key={f.key} type="small" themeColor="textSecondary" style={styles.fieldCol}>
            {f.label}
          </ThemedText>
        ))}
      </View>

      {exercise.sets.map((s, i) => (
        <RoutineSetRow key={s.id} set={s} label={labels[i]} fields={fields} onChanged={onChanged} />
      ))}

      <Pressable
        onPress={() => addRoutineSet(db, exercise.id).then(onChanged)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.addSet, { backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}>
        <ThemedText type="smallBold">+ Legg til sett</ThemedText>
      </Pressable>
    </View>
  );
}

function RoutineSetRow({ set, label, fields, onChanged }: { set: RoutineSet; label: string; fields: Field[]; onChanged: () => void }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [draft, setDraft] = useState<Record<RoutineSetField, string>>(() => ({
    targetReps: formatNumber(set.targetReps, 0),
    targetWeightKg: set.targetWeightKg === null ? '' : formatNumber(toDisplay(set.targetWeightKg)),
    targetDurationSeconds: formatNumber(set.targetDurationSeconds, 0),
  }));

  const onChangeText = (f: Field, text: string) => {
    setDraft((d) => ({ ...d, [f.key]: text }));
    const raw = f.decimal ? parseDecimal(text) : parseInteger(text);
    const value = raw !== null && f.key === 'targetWeightKg' ? fromDisplay(raw) : raw;
    updateRoutineSetField(db, set.id, f.key, value).catch(() => {});
  };

  const cycleType = async () => {
    await setRoutineSetType(db, set.id, nextSetType(set.setType));
    Haptics.selectionAsync().catch(() => {});
    onChanged();
  };

  const confirmDelete = () => {
    Alert.alert('Slette settet?', undefined, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Slett', style: 'destructive', onPress: () => deleteRoutineSet(db, set.id).then(onChanged) },
    ]);
  };

  const labelColor = set.setType === 'WARMUP' ? theme.textSecondary : set.setType === 'NORMAL' ? theme.text : theme.accent;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={cycleType}
        onLongPress={confirmDelete}
        accessibilityRole="button"
        accessibilityLabel={`Sett ${label}, ${SET_TYPE_NAMES[set.setType]}`}
        accessibilityHint="Trykk for å bytte type. Hold inne for å slette."
        accessibilityActions={[
          { name: 'activate', label: 'Bytt type' },
          { name: 'delete', label: 'Slett settet' },
        ]}
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'delete' ? confirmDelete() : cycleType())}
        style={styles.labelCol}>
        <ThemedText type="smallBold" style={{ color: labelColor, textAlign: 'center' }}>
          {label}
        </ThemedText>
      </Pressable>
      {fields.map((f) => (
        <TextInput
          key={f.key}
          value={draft[f.key]}
          onChangeText={(t) => onChangeText(f, t)}
          placeholder="–"
          placeholderTextColor={theme.textSecondary}
          keyboardType={f.decimal ? 'decimal-pad' : 'number-pad'}
          selectTextOnFocus
          accessibilityLabel={`Mål ${f.label}`}
          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  thumb: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 17 },
  columns: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  labelCol: { width: 40, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  fieldCol: { flex: 1, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: { flex: 1, minHeight: 44, borderRadius: Radius.small, textAlign: 'center', fontSize: 17, fontWeight: 600, fontVariant: ['tabular-nums'] },
  addSet: { minHeight: 44, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.one },
});
