import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ChoiceRow, SettingsRow, SettingsSection } from '@/features/settings/settings-row';
import { REST_OPTIONS, restTimer, useRestTimer } from '@/features/workout/rest-timer';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/format';
import { syncPendingWorkouts } from '@/services/sync';
import { getSettings, setWeeklyGoal } from '@/storage/settings-store';
import { MaxContentWidth, Spacing } from '@/theme';

/** Treningsinnstillinger: ukesmål (vises på Hjem) og standard hviletid etter hvert sett. */
export default function TrainingSettings() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { state, reload } = useLocalQuery(getSettings);
  const weekly = state.status === 'ready' ? state.data.weeklyWorkoutGoal : null;
  const { defaultSeconds } = useRestTimer();

  const changeWeekly = async (n: number | null) => {
    await setWeeklyGoal(db, n);
    reload();
    syncPendingWorkouts(db).catch(() => {});
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <SettingsSection first title="Ukesmål" subtitle="Antall økter per uke, vises på Hjem">
        <SettingsRow icon="target" title="Økter per uke" right={<Stepper value={weekly} onChange={changeWeekly} />} />
      </SettingsSection>

      <SettingsSection title="Hviletimer" subtitle="Starter automatisk når du fullfører et sett">
        {REST_OPTIONS.map((s) => (
          <ChoiceRow key={s} label={s === 0 ? 'Av' : formatDuration(s)} selected={s === defaultSeconds} onPress={() => restTimer.setDefault(s)} />
        ))}
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          I supersett starter hvilen først etter siste øvelse. Du kan også endre hviletiden fra timeren under en økt.
        </ThemedText>
      </SettingsSection>
    </ScrollView>
  );
}

/** − verdi + (av = null), 1–14. */
function Stepper({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const theme = useTheme();
  const dec = () => onChange(value === null || value <= 1 ? null : value - 1);
  const inc = () => onChange(Math.min(14, (value ?? 0) + 1));
  return (
    <View
      style={styles.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Ukesmål"
      accessibilityValue={{ text: value === null ? 'Av' : `${value} økter` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? inc() : dec())}>
      <Pressable
        onPress={dec}
        disabled={value === null}
        style={[styles.stepButton, { backgroundColor: theme.backgroundElement, opacity: value === null ? 0.4 : 1 }]}>
        <ThemedText style={styles.stepText}>−</ThemedText>
      </Pressable>
      <ThemedText style={styles.stepValue}>{value === null ? 'Av' : value}</ThemedText>
      <Pressable onPress={inc} disabled={value === 14} style={[styles.stepButton, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={styles.stepText}>+</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  note: { marginTop: Spacing.three },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22, lineHeight: 26, fontWeight: 700 },
  stepValue: { minWidth: 32, textAlign: 'center', fontWeight: 700, fontVariant: ['tabular-nums'] },
});
