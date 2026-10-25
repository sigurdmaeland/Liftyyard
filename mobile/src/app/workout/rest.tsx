import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { REST_OPTIONS, restTimer, useRestTimer } from '@/features/workout/rest-timer';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/format';
import { Spacing } from '@/theme';

/** Velg automatisk hviletid etter hvert fullførte sett, eller start en pause manuelt. */
export default function RestTimerSheet() {
  const theme = useTheme();
  const { defaultSeconds } = useRestTimer();

  return (
    <ThemedView style={styles.sheet}>
      <ThemedText accessibilityRole="header" type="smallBold" style={styles.title}>
        Hviletimer
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        Starter automatisk når du fullfører et sett.
      </ThemedText>
      {REST_OPTIONS.map((s) => {
        const selected = s === defaultSeconds;
        return (
          <Pressable
            key={s}
            onPress={() => restTimer.setDefault(s)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.option, { borderBottomColor: theme.backgroundSelected }]}>
            <ThemedText style={styles.optionLabel}>{s === 0 ? 'Av' : formatDuration(s)}</ThemedText>
            {selected && <Icon name="checkmark" color={theme.accent} fallback="✓" />}
          </Pressable>
        );
      })}
      <View style={styles.actions}>
        <Button
          label="Start pause nå"
          disabled={defaultSeconds === 0}
          onPress={() => {
            restTimer.startDefault();
            router.back();
          }}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: Spacing.three, paddingBottom: Spacing.five },
  title: { fontSize: 17, textAlign: 'center' },
  hint: { textAlign: 'center', marginBottom: Spacing.two },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
  optionLabel: { fontSize: 17, fontVariant: ['tabular-nums'] },
  actions: { marginTop: Spacing.three },
});
