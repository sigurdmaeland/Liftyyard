import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CloseButton, SaveButton } from '@/features/profile/header-save';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber, parseDecimal } from '@/lib/format';
import { syncPendingWorkouts } from '@/services/sync';
import { addMeasurement } from '@/storage/measurement-store';
import { Radius, Spacing } from '@/theme';
import { MEASUREMENT_LABELS, fromMeasurementDisplay, isMeasurementKind, measurementLimits, measurementUnit } from '@/types/measurement';

/** Registrer en måling (?kind=WEIGHT, WAIST, …). Dato kan settes tilbake i tid. */
export default function AddMeasurementScreen() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const db = useSQLiteContext();
  const theme = useTheme();
  const [text, setText] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [saving, setSaving] = useState(false);

  if (!isMeasurementKind(kind)) {
    return (
      <ThemedView style={styles.fill}>
        <ThemedText style={styles.content}>Ukjent måling.</ThemedText>
      </ThemedView>
    );
  }

  const unit = measurementUnit(kind);
  const limits = measurementLimits(kind);
  const value = parseDecimal(text);
  const valid = value !== null && value >= limits.min && value <= limits.max;
  const showError = text.trim() !== '' && !valid;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    // Ikke frem i tid: velges dagens dato, brukes klokkeslettet nå.
    const at = date.getTime() > Date.now() ? new Date() : date;
    await addMeasurement(db, kind, fromMeasurementDisplay(kind, value), at.toISOString());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    syncPendingWorkouts(db).catch(() => {});
    router.back();
  };

  const openAndroidPicker = () =>
    DateTimePickerAndroid.open({ value: date, mode: 'date', maximumDate: new Date(), onValueChange: (_e, d) => setDate(d) });

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen
        options={{
          title: MEASUREMENT_LABELS[kind],
          headerLeft: () => <CloseButton />,
          headerRight: () => <SaveButton onPress={save} disabled={!valid || saving} />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.valueBox, { borderColor: showError ? theme.danger : theme.backgroundSelected }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            autoFocus
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
            onSubmitEditing={save}
            accessibilityLabel={`${MEASUREMENT_LABELS[kind]} i ${unit}`}
            style={[styles.value, { color: theme.text }]}
          />
          <ThemedText style={styles.unit} themeColor="textSecondary">
            {unit}
          </ThemedText>
        </View>
        {showError && (
          <ThemedText type="small" style={{ color: theme.danger }}>
            Skriv en verdi mellom {formatNumber(limits.min)} og {formatNumber(limits.max)} {unit}.
          </ThemedText>
        )}

        <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.flex}>Dato</ThemedText>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={date}
              mode="date"
              display="compact"
              locale="nb-NO"
              maximumDate={new Date()}
              onValueChange={(_e, d) => setDate(d)}
            />
          ) : (
            <Pressable onPress={openAndroidPicker} accessibilityRole="button">
              <ThemedText>{date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}</ThemedText>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  valueBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  value: { flex: 1, fontSize: 34, fontWeight: 700, paddingVertical: Spacing.three, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 20, fontWeight: 600 },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.three, minHeight: 52 },
});
