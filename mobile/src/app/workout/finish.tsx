import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Stack, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatTime, parseInteger } from '@/lib/format';
import { syncPendingWorkouts } from '@/services/sync';
import { addWorkoutPhoto } from '@/storage/photo-store';
import { finishWorkout, getActiveWorkout } from '@/storage/workout-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';
import type { Workout, WorkoutVisibility } from '@/types/workout';
import { PhotoStrip } from '@/features/workout/photo-strip';
import { VisibilityPicker } from '@/features/workout/visibility-picker';
import { uuidv7 } from '@/lib/ids';

const EFFORT_LABELS: Record<number, string> = {
  1: 'Veldig lett', 2: 'Lett', 3: 'Lett', 4: 'Moderat', 5: 'Moderat',
  6: 'Litt tung', 7: 'Tung', 8: 'Veldig tung', 9: 'Nesten maks', 10: 'Maks',
};

/** «Fullfør økt»: navn, beskrivelse, tidspunkt, varighet, anstrengelse og private notater før lagring. */
export default function FinishWorkoutScreen() {
  const { state } = useLocalQuery(getActiveWorkout);
  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ title: 'Fullfør økt' }} />
      {state.status === 'ready' && state.data && <FinishForm key={state.data.id} workout={state.data} />}
    </ThemedView>
  );
}

function FinishForm({ workout }: { workout: Workout }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [name, setName] = useState(workout.name);
  const [description, setDescription] = useState(workout.description ?? '');
  const [notes, setNotes] = useState(workout.notes ?? '');
  const [start, setStart] = useState(() => new Date(workout.startedAt));
  const [minutes, setMinutes] = useState(() =>
    String(Math.max(1, Math.round((Date.now() - new Date(workout.startedAt).getTime()) / 60000))),
  );
  const [effort, setEffort] = useState<number | null>(workout.perceivedEffort);
  const [visibility, setVisibility] = useState<WorkoutVisibility>(workout.visibility);
  const [photos, setPhotos] = useState<{ id: string; uri: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const duration = parseInteger(minutes);
  const unfinished = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.completedAt).length, 0);
  const valid = name.trim().length > 0 && duration !== null && duration >= 1 && duration <= 24 * 60;

  const save = async () => {
    if (!valid || duration === null) return;
    setSaving(true);
    const ok = await finishWorkout(db, workout.id, {
      name: name.trim(),
      description: description.trim() || null,
      notes: notes.trim() || null,
      perceivedEffort: effort,
      startedAt: start.toISOString(),
      endedAt: new Date(start.getTime() + duration * 60000).toISOString(),
      visibility,
    });
    if (!ok) {
      setSaving(false);
      return;
    }
    for (const p of photos) await addWorkoutPhoto(db, workout.id, p.uri);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    syncPendingWorkouts(db).catch(() => {});
    // Erstatter hele økt-modalen med oppsummeringen.
    router.replace({ pathname: '/history/[id]', params: { id: workout.id, finished: '1' } });
  };

  const openAndroidPicker = () => {
    DateTimePickerAndroid.open({
      value: start,
      mode: 'date',
      maximumDate: new Date(),
      onValueChange: (_e, date) => {
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onValueChange: (_e2, time) => setStart(time),
        });
      },
    });
  };

  const field = [styles.field, { borderColor: theme.backgroundSelected, color: theme.text }];

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput value={name} onChangeText={setName} maxLength={100} style={field} accessibilityLabel="Navn på økten" />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Hvordan gikk det? Fortell litt om økten."
          accessibilityLabel="Beskrivelse av økten, vises for andre"
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={2000}
          style={[field, styles.multiline]}
        />

        <ThemedText accessibilityRole="header" type="smallBold" style={styles.section}>
          Detaljer
        </ThemedText>

        <DetailRow icon="calendar">
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={start}
              mode="datetime"
              display="compact"
              locale="nb-NO"
              maximumDate={new Date()}
              onValueChange={(_e, date) => setStart(date)}
            />
          ) : (
            <Pressable onPress={openAndroidPicker} accessibilityRole="button">
              <ThemedText>
                {formatDate(start.toISOString())} kl. {formatTime(start.toISOString())}
              </ThemedText>
            </Pressable>
          )}
        </DetailRow>

        <DetailRow icon="clock">
          <TextInput
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
            style={[styles.minutes, { color: theme.text }]}
            accessibilityLabel="Varighet i minutter"
            maxLength={4}
          />
          <ThemedText themeColor="textSecondary">min</ThemedText>
        </DetailRow>

        <View style={[styles.effortBox, { borderColor: theme.backgroundSelected }]}>
          <View style={styles.effortHeader}>
            <Icon name="gauge.with.dots.needle.67percent" color={theme.textSecondary} fallback="◔" />
            <ThemedText themeColor={effort ? 'text' : 'textSecondary'}>
              {effort ? `${effort}/10 · ${EFFORT_LABELS[effort]}` : 'Hvor tung var økten?'}
            </ThemedText>
          </View>
          <View style={styles.effortRow}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const selected = effort === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => {
                    setEffort(selected ? null : n);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Anstrengelse ${n} av 10`}
                  style={[styles.effortChip, { backgroundColor: selected ? theme.text : theme.backgroundElement }]}>
                  <ThemedText type="smallBold" style={{ color: selected ? theme.background : theme.text }}>
                    {n}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ThemedText accessibilityRole="header" type="smallBold" style={styles.section}>
          Bilder
        </ThemedText>
        <PhotoStrip
          photos={photos}
          onAdd={(uri) => setPhotos((list) => [...list, { id: uuidv7(), uri }])}
          onRemove={(id) => setPhotos((list) => list.filter((p) => p.id !== id))}
        />

        <ThemedText accessibilityRole="header" type="smallBold" style={styles.section}>
          Hvem kan se økten?
        </ThemedText>
        <VisibilityPicker value={visibility} onChange={setVisibility} />

        <View style={[styles.notesBox, { borderColor: theme.backgroundSelected }]}>
          <Icon name="lock" color={theme.textSecondary} fallback="🔒" style={styles.lock} />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Private notater …"
          accessibilityLabel="Private notater, bare for deg"
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={2000}
            style={[styles.notesInput, { color: theme.text }]}
          />
        </View>

        {unfinished > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            {unfinished === 1 ? '1 sett' : `${unfinished} sett`} uten ✓ blir ikke lagret.
          </ThemedText>
        )}

        <Pressable
          onPress={save}
          disabled={!valid || saving}
          accessibilityRole="button"
          style={({ pressed }) => [styles.save, { backgroundColor: theme.text, opacity: !valid || saving ? 0.4 : pressed ? 0.85 : 1 }]}>
          <ThemedText type="smallBold" style={[styles.saveLabel, { color: theme.background }]}>
            Lagre
          </ThemedText>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DetailRow({ icon, children }: { icon: SFSymbol; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.detailRow, { borderColor: theme.backgroundSelected }]}>
      <Icon name={icon} color={theme.textSecondary} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  field: { borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 17 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  section: { fontSize: 17, marginTop: Spacing.two },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, minHeight: 56 },
  minutes: { fontSize: 17, minWidth: 48, paddingVertical: Spacing.two },
  effortBox: { borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.three },
  effortHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  effortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  effortChip: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  notesBox: { flexDirection: 'row', gap: Spacing.three, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three, minHeight: 96 },
  lock: { marginTop: 2 },
  notesInput: { flex: 1, fontSize: 17, textAlignVertical: 'top', paddingVertical: 0 },
  save: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.two },
  saveLabel: { fontSize: 17 },
});
