import { Stack, router, useLocalSearchParams } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { EQUIPMENT_LABELS, EXERCISE_TYPE_LABELS, MUSCLE_LABELS } from '@/lib/labels';
import { syncPendingWorkouts } from '@/services/sync';
import { getExercise, saveCustomExercise } from '@/storage/exercise-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';
import type { Exercise, ExerciseType } from '@/types/workout';

/** Lag eller rediger en egendefinert øvelse (?id=<id> for redigering). Bilde/video kommer med medialagring. */
export default function EditExerciseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const query = useCallback((db: SQLiteDatabase) => (id ? getExercise(db, id) : Promise.resolve(null)), [id]);
  const { state } = useLocalQuery(query);
  if (state.status !== 'ready') return <ThemedView style={styles.fill} />;
  return <Editor key={id ?? 'new'} existing={state.data} />;
}

type Section = 'type' | 'equipment' | 'primary' | 'secondary' | null;

function Editor({ existing }: { existing: Exercise | null }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [name, setName] = useState(existing?.name ?? '');
  const [instructions, setInstructions] = useState(existing?.instructions ?? '');
  const [type, setType] = useState<ExerciseType>(existing?.exerciseType ?? 'WEIGHT_REPS');
  const [equipment, setEquipment] = useState<string | null>(existing?.equipment ?? null);
  const [primary, setPrimary] = useState<string[]>(existing?.primaryMuscles ?? []);
  const [secondary, setSecondary] = useState<string[]>(existing?.secondaryMuscles ?? []);
  const [open, setOpen] = useState<Section>(null);
  const valid = name.trim().length > 0;

  const save = async () => {
    if (!valid) return;
    const savedId = await saveCustomExercise(
      db,
      {
        name: name.trim(),
        exerciseType: type,
        equipment: equipment ?? 'OTHER',
        instructions: instructions.trim() || null,
        primaryMuscles: primary,
        secondaryMuscles: secondary.filter((m) => !primary.includes(m)),
      },
      existing?.id,
    );
    syncPendingWorkouts(db).catch(() => {});
    if (existing) router.back();
    else router.replace({ pathname: '/exercise/[id]', params: { id: savedId } });
  };

  const toggle = (list: string[], set: (v: string[]) => void, m: string) =>
    set(list.includes(m) ? list.filter((x) => x !== m) : [...list, m]);

  const field = [styles.field, { borderColor: theme.backgroundSelected, color: theme.text }];

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen
        options={{
          title: existing ? 'Rediger øvelse' : 'Lag øvelse',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Lukk">
              <Icon name="xmark" color={theme.text} fallback="✕" />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={save}
              disabled={!valid}
              accessibilityRole="button"
              style={[styles.save, { backgroundColor: theme.accentFill, opacity: valid ? 1 : 0.4 }]}>
              <ThemedText type="smallBold" style={styles.saveLabel}>
                Lagre
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Navn på øvelsen"
            accessibilityLabel="Navn på øvelsen"
            placeholderTextColor={theme.textSecondary}
            maxLength={100}
            autoFocus={!existing}
            style={field}
          />
          <TextInput
            value={instructions}
            onChangeText={setInstructions}
            placeholder="Instruksjoner (valgfritt)"
            accessibilityLabel="Instruksjoner, valgfritt"
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={4000}
            style={[field, styles.multiline]}
          />

          <Row label="Treningstype" value={EXERCISE_TYPE_LABELS[type]} highlight onPress={() => setOpen(open === 'type' ? null : 'type')} />
          {open === 'type' && (
            <Options
              options={Object.keys(EXERCISE_TYPE_LABELS)}
              labels={EXERCISE_TYPE_LABELS}
              selected={[type]}
              onToggle={(v) => {
                setType(v as ExerciseType);
                setOpen(null);
              }}
            />
          )}

          <Row label="Utstyr" value={equipment ? EQUIPMENT_LABELS[equipment] : 'Valgfri'} onPress={() => setOpen(open === 'equipment' ? null : 'equipment')} />
          {open === 'equipment' && (
            <Options
              options={Object.keys(EQUIPMENT_LABELS)}
              labels={EQUIPMENT_LABELS}
              selected={equipment ? [equipment] : []}
              onToggle={(v) => {
                setEquipment(v === equipment ? null : v);
                setOpen(null);
              }}
            />
          )}

          <Row
            label="Primære muskler"
            value={primary.length ? primary.map((m) => MUSCLE_LABELS[m]).join(', ') : 'Valgfri'}
            onPress={() => setOpen(open === 'primary' ? null : 'primary')}
          />
          {open === 'primary' && (
            <Options options={Object.keys(MUSCLE_LABELS)} labels={MUSCLE_LABELS} selected={primary} onToggle={(m) => toggle(primary, setPrimary, m)} />
          )}

          <Row
            label="Sekundære muskler"
            value={secondary.length ? secondary.map((m) => MUSCLE_LABELS[m]).join(', ') : 'Valgfri'}
            onPress={() => setOpen(open === 'secondary' ? null : 'secondary')}
          />
          {open === 'secondary' && (
            <Options
              options={Object.keys(MUSCLE_LABELS).filter((m) => !primary.includes(m))}
              labels={MUSCLE_LABELS}
              selected={secondary}
              onToggle={(m) => toggle(secondary, setSecondary, m)}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function Row({ label, value, onPress, highlight }: { label: string; value: string; onPress: () => void; highlight?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.row, { borderBottomColor: theme.backgroundSelected }]}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <ThemedText numberOfLines={1} style={[styles.rowValue, { color: highlight ? theme.accent : theme.textSecondary }]}>
        {value}
      </ThemedText>
    </Pressable>
  );
}

function Options({
  options,
  labels,
  selected,
  onToggle,
}: {
  options: string[];
  labels: Record<string, string>;
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.options}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <Pressable
            key={o}
            onPress={() => onToggle(o)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.option, { backgroundColor: on ? theme.accentFill : theme.tile }]}>
            <ThemedText style={{ color: on ? '#FFFFFF' : theme.text }}>{labels[o]}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  field: { borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 17 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, paddingVertical: Spacing.four, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { fontSize: 18 },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
  save: { paddingHorizontal: Spacing.four, minHeight: 44, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  saveLabel: { color: '#FFFFFF', fontSize: 16 },
});
