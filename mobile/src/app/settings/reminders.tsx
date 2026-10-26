import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { LiftyardMark } from '@/components/liftyard-mark';
import { ThemedText } from '@/components/themed-text';
import { WEEKDAY_NAMES, ensureNotificationPermission, updateReminder, useReminders } from '@/features/settings/reminders';
import { useTheme } from '@/hooks/use-theme';
import { type Reminder, formatTime } from '@/lib/reminders';
import { MaxContentWidth, Radius, Spacing } from '@/theme';

const asDate = (r: Reminder) => {
  const d = new Date();
  d.setHours(r.hour, r.minute, 0, 0);
  return d;
};

/** Treningspåminnelser: et varsel på valgte dager og klokkeslett, hver uke. */
export default function RemindersSettings() {
  const theme = useTheme();
  const reminders = useReminders();

  const save = (next: Reminder) =>
    updateReminder(next).catch(() => Alert.alert('Kunne ikke planlegge påminnelsen', 'Prøv igjen.'));

  const toggle = async (r: Reminder, enabled: boolean) => {
    if (enabled && !(await ensureNotificationPermission())) {
      Alert.alert('Varsler er slått av', 'Gi Liftyard lov til å sende varsler i telefonens innstillinger for å få påminnelser.', [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Åpne innstillinger', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    save({ ...r, enabled });
  };

  const changeTime = (r: Reminder, d: Date | undefined) => {
    if (!d) return;
    // Å velge et klokkeslett betyr at man vil ha påminnelsen, så dagen slås på.
    const next = { ...r, hour: d.getHours(), minute: d.getMinutes() };
    if (r.enabled) save(next);
    else toggle(next, true);
  };

  const openAndroidPicker = (r: Reminder) =>
    DateTimePickerAndroid.open({ value: asDate(r), mode: 'time', is24Hour: true, onValueChange: (_e, d) => changeTime(r, d) });

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <ThemedText style={styles.title}>Hold deg på sporet.{'\n'}Slå på påminnelser.</ThemedText>
      <ThemedText themeColor="textSecondary">Velg hvilke dager og klokkeslett du vil bli påminnet om å trene.</ThemedText>

      <View style={[styles.preview, { backgroundColor: theme.backgroundElement }]} accessible accessibilityLabel="Eksempel: Treningspåminnelse. På tide med økt!">
        <View style={[styles.appIcon, { backgroundColor: theme.accentFill }]}>
          <LiftyardMark size={34} color="#FFFFFF" />
        </View>
        <View style={styles.previewText}>
          <ThemedText style={styles.previewTitle}>Treningspåminnelse</ThemedText>
          <ThemedText themeColor="textSecondary">På tide med økt! 💪</ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.now}>
          nå
        </ThemedText>
      </View>

      <View>
        {reminders.map((r) => (
          <View key={r.weekday} style={[styles.row, { borderBottomColor: theme.backgroundSelected }]}>
            <ThemedText style={styles.day}>{WEEKDAY_NAMES[r.weekday - 1]}</ThemedText>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={asDate(r)}
                mode="time"
                display="compact"
                locale="nb-NO"
                minuteInterval={5}
                onValueChange={(_e, d) => changeTime(r, d)}
                accessibilityLabel={`Klokkeslett for ${WEEKDAY_NAMES[r.weekday - 1].toLowerCase()}`}
              />
            ) : (
              <Pressable
                onPress={() => openAndroidPicker(r)}
                accessibilityRole="button"
                accessibilityLabel={`Klokkeslett for ${WEEKDAY_NAMES[r.weekday - 1].toLowerCase()}, ${formatTime(r)}`}
                style={[styles.timePill, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.time}>{formatTime(r)}</ThemedText>
              </Pressable>
            )}
            <Switch
              value={r.enabled}
              onValueChange={(v) => toggle(r, v)}
              accessibilityLabel={`Påminnelse på ${WEEKDAY_NAMES[r.weekday - 1].toLowerCase()}`}
            />
          </View>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Påminnelsene kommer hver uke til du slår dem av, også uten nett.
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 800 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.large, marginVertical: Spacing.two },
  appIcon: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewText: { flex: 1, gap: 2 },
  previewTitle: { fontWeight: 700 },
  now: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth },
  day: { flex: 1, fontSize: 17 },
  timePill: { minHeight: 40, paddingHorizontal: Spacing.three, borderRadius: 20, justifyContent: 'center' },
  time: { fontSize: 17, fontVariant: ['tabular-nums'] },
});
