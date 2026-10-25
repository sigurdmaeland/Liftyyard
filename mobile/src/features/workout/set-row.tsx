import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Pop } from '@/components/pop';
import { showToast } from '@/components/toast';
import { MEDAL_COLORS } from '@/features/workout-view/medals';
import { RECORD_DESCRIPTIONS } from '@/lib/records';
import { newRecordsForSet } from '@/storage/records-store';
import { restTimer } from '@/features/workout/rest-timer';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber, parseDecimal, parseInteger } from '@/lib/format';
import { type SetField, fieldsFor, nextSetType, requiredFieldsFor } from '@/lib/set-fields';
import { deleteSet, setCompleted, setSetType, updateSetField } from '@/storage/workout-store';
import { Radius, Spacing } from '@/theme';
import type { ExerciseType, WorkoutSet } from '@/types/workout';
import { SET_TYPE_NAMES } from '@/types/workout';
import { fromDisplay, toDisplay } from '@/lib/units';

type Props = {
  workoutId: string;
  exerciseType: ExerciseType;
  set: WorkoutSet;
  label: string;
  previousText: string;
  suggestion: Partial<Record<SetField, number>>;
  /** Start hviletimeren når settet fullføres. Av for alle unntatt siste øvelse i et supersett. */
  startsRest?: boolean;
  onChanged: () => void;
};

/**
 * Én rad i settabellen. Verdiene lagres lokalt mens brukeren skriver. Trykk på ✓ fullfører
 * settet. Tomme felt fylles da med forslaget (forrige gang eller forrige sett).
 * Trykk på settnummeret bytter type, og langt trykk sletter settet.
 */
export function SetRow({ workoutId, exerciseType, set, label, previousText, suggestion, startsRest = true, onChanged }: Props) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const fields = fieldsFor(exerciseType);
  const completed = set.completedAt !== null;
  const [draft, setDraft] = useState<Record<SetField, string>>(() => ({
    weightKg: set.weightKg === null ? '' : formatNumber(toDisplay(set.weightKg)),
    reps: formatNumber(set.reps, 0),
    durationSeconds: formatNumber(set.durationSeconds, 0),
    distanceM: formatNumber(set.distanceM),
  }));

  // Vekt skrives i valgt enhet (kg/lb) og lagres alltid i kg.
  const parse = (field: SetField, text: string) => {
    if (field === 'weightKg') {
      const v = parseDecimal(text);
      return v === null ? null : fromDisplay(v);
    }
    return field === 'distanceM' ? parseDecimal(text) : parseInteger(text);
  };

  const onChangeText = (field: SetField, text: string) => {
    setDraft((d) => ({ ...d, [field]: text }));
    updateSetField(db, set.id, field, parse(field, text)).catch(() => {});
  };

  const toggleComplete = async () => {
    if (completed) {
      await setCompleted(db, workoutId, set.id, null);
      onChanged();
      return;
    }
    const values: Partial<Record<SetField, number | null>> = {};
    for (const f of fields) {
      values[f.key] = parse(f.key, draft[f.key]) ?? suggestion[f.key] ?? null;
    }
    const missing = requiredFieldsFor(exerciseType).some((k) => values[k] === null || values[k] === undefined);
    if (missing) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    await setCompleted(db, workoutId, set.id, values);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (startsRest) restTimer.startDefault();
    onChanged();
    // Ny personlig rekord? Vis det med en gang, mens man fortsatt er i økten.
    const records = await newRecordsForSet(db, set.id, values.weightKg ?? null, values.reps ?? null).catch(() => []);
    if (records.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast({
        title: 'Ny rekord! 🏅',
        text: records.map((r) => RECORD_DESCRIPTIONS[r]).join(', ').replace(/^./, (c) => c.toUpperCase()),
        icon: 'medal.fill',
        iconColor: MEDAL_COLORS[1],
      });
    }
  };

  const cycleType = async () => {
    await setSetType(db, set.id, nextSetType(set.setType));
    Haptics.selectionAsync().catch(() => {});
    onChanged();
  };

  const confirmDelete = () => {
    Alert.alert('Slette settet?', undefined, [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Slett',
        style: 'destructive',
        onPress: async () => {
          await deleteSet(db, workoutId, set.id);
          onChanged();
        },
      },
    ]);
  };

  const labelColor =
    set.setType === 'WARMUP' ? theme.textSecondary : set.setType === 'NORMAL' ? theme.text : theme.accent;

  return (
    <View style={[styles.row, completed && { backgroundColor: `${theme.successFill}22` }]}>
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
        style={styles.labelCell}>
        <ThemedText type="smallBold" style={{ color: labelColor }}>
          {label}
        </ThemedText>
      </Pressable>

      <ThemedText type="small" themeColor="textSecondary" style={styles.previous} numberOfLines={1}>
        {previousText || '–'}
      </ThemedText>

      {fields.map((f) => (
        <TextInput
          key={f.key}
          value={draft[f.key]}
          onChangeText={(t) => onChangeText(f.key, t)}
          placeholder={
            suggestion[f.key] !== undefined ? formatNumber(f.key === 'weightKg' ? toDisplay(suggestion[f.key]!) : suggestion[f.key]) : f.label
          }
          placeholderTextColor={theme.textSecondary}
          keyboardType={f.decimal ? 'decimal-pad' : 'number-pad'}
          editable={!completed}
          selectTextOnFocus
          accessibilityLabel={`${f.label}, sett ${label}`}
          style={[styles.input, { color: theme.text, backgroundColor: completed ? 'transparent' : theme.backgroundSelected }]}
        />
      ))}

      <Pressable
        onPress={toggleComplete}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
        accessibilityLabel={`Fullfør sett ${label}`}
        hitSlop={8}
        style={[styles.check, { backgroundColor: completed ? theme.successFill : theme.backgroundSelected }]}>
        <Pop trigger={completed}>
          <ThemedText type="smallBold" style={{ color: completed ? '#FFFFFF' : theme.textSecondary }}>
            ✓
          </ThemedText>
        </Pop>
      </Pressable>
    </View>
  );
}

export const SET_ROW_COLUMNS = { label: 36, previous: 84, check: 40 };

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.small,
  },
  labelCell: { width: SET_ROW_COLUMNS.label, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  previous: { width: SET_ROW_COLUMNS.previous },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.small,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  check: {
    width: SET_ROW_COLUMNS.check,
    height: 40,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
