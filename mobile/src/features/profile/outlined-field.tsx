import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/theme';

/**
 * Felt med ramme der etiketten ligger i rammen når feltet har innhold (og som plassholder ellers).
 * Med `onPress` blir feltet en knapp som viser `display` (for dato og valg).
 */
export function OutlinedField({
  label,
  value,
  onChangeText,
  onPress,
  display,
  placeholder,
  floatLabel,
  style,
  ...input
}: {
  label: string;
  value?: string;
  onChangeText?: (v: string) => void;
  onPress?: () => void;
  /** Tekst som vises i et trykkbart felt. */
  display?: ReactNode;
  /** Plassholder når etiketten alltid ligger i rammen. */
  placeholder?: string;
  /** Vis etiketten i rammen også når feltet er tomt. */
  floatLabel?: boolean;
  style?: object;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'style'>) {
  const theme = useTheme();
  const filled = floatLabel || (value !== undefined && value !== '') || (display !== undefined && display !== null);
  const box = [styles.box, { borderColor: theme.textSecondary }, input.multiline && styles.multilineBox, style];

  return (
    <View style={styles.wrap}>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={box}>
          {display !== undefined && display !== null ? (
            <ThemedText style={styles.text}>{display}</ThemedText>
          ) : (
            <ThemedText style={styles.text} themeColor="textSecondary">
              {placeholder ?? label}
            </ThemedText>
          )}
        </Pressable>
      ) : (
        <View style={box}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={filled ? placeholder : label}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={label}
            style={[styles.text, styles.input, { color: theme.text }, input.multiline && styles.multilineInput]}
            {...input}
          />
        </View>
      )}
      {filled && (
        <View style={[styles.label, { backgroundColor: theme.background }]} pointerEvents="none">
          <ThemedText type="small" themeColor="textSecondary">
            {label}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 10 },
  box: { minHeight: 60, borderWidth: 1, borderRadius: Radius.small, paddingHorizontal: Spacing.three, justifyContent: 'center' },
  multilineBox: { minHeight: 60, paddingVertical: Spacing.two },
  text: { fontSize: 17 },
  input: { paddingVertical: Spacing.three },
  multilineInput: { paddingVertical: Spacing.one, maxHeight: 140 },
  label: { position: 'absolute', top: 0, left: Spacing.three - 4, paddingHorizontal: 4 },
});
