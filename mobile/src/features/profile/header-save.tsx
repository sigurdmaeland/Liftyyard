import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme';

/** Lukkeknapp og «Lagre»-knapp for skjemaene i modaler (samme stil som «Lag øvelse»). */
export function CloseButton() {
  const theme = useTheme();
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Lukk">
      <Icon name="xmark" color={theme.text} fallback="✕" />
    </Pressable>
  );
}

export function SaveButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[styles.save, { backgroundColor: theme.accentFill, opacity: disabled ? 0.4 : 1 }]}>
      <ThemedText type="smallBold" style={styles.label}>
        Lagre
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  save: { paddingHorizontal: Spacing.four, minHeight: 44, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: { color: '#FFFFFF', fontSize: 16 },
});
