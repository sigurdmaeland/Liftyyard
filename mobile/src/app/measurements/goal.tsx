import { Stack, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CloseButton, SaveButton } from '@/features/profile/header-save';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber, parseDecimal } from '@/lib/format';
import { syncPendingWorkouts } from '@/services/sync';
import { getGoalWeight, setGoalWeight } from '@/storage/measurement-store';
import { Radius, Spacing } from '@/theme';
import { fromMeasurementDisplay, measurementLimits } from '@/types/measurement';
import { toDisplay, unitLabel } from '@/lib/units';

/** Sett, endre eller fjern vektmålet. */
export default function GoalScreen() {
  const { state } = useLocalQuery(getGoalWeight);
  if (state.status !== 'ready') return <ThemedView style={styles.fill} />;
  return <GoalForm existing={state.data} />;
}

function GoalForm({ existing }: { existing: number | null }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [text, setText] = useState(existing !== null ? formatNumber(toDisplay(existing), 1) : '');
  const limits = measurementLimits('WEIGHT');
  const value = parseDecimal(text);
  const valid = value !== null && value >= limits.min && value <= limits.max;

  const save = async (kg: number | null) => {
    await setGoalWeight(db, kg === null ? null : fromMeasurementDisplay('WEIGHT', kg));
    syncPendingWorkouts(db).catch(() => {});
    router.back();
  };

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen
        options={{
          title: 'Vektmål',
          headerLeft: () => <CloseButton />,
          headerRight: () => <SaveButton onPress={() => valid && save(value)} disabled={!valid} />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText themeColor="textSecondary">Hvilken vekt sikter du mot?</ThemedText>
        <View style={[styles.valueBox, { borderColor: theme.backgroundSelected }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            autoFocus
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={`Vektmål i ${unitLabel() === 'lb' ? 'pund' : 'kilo'}`}
            style={[styles.value, { color: theme.text }]}
          />
          <ThemedText style={styles.unit} themeColor="textSecondary">
            {unitLabel()}
          </ThemedText>
        </View>
        {existing !== null && (
          <Pressable onPress={() => save(null)} accessibilityRole="button" style={styles.remove}>
            <ThemedText style={{ color: theme.danger, fontWeight: 600 }}>Fjern mål</ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  valueBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  value: { flex: 1, fontSize: 34, fontWeight: 700, paddingVertical: Spacing.three, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 20, fontWeight: 600 },
  remove: { alignSelf: 'center', padding: Spacing.three },
});
