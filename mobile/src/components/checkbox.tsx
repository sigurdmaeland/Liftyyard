import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme';

/** Avkrysningsboks med tekst. Hele raden er trykkflaten (minst 48 pt høy). */
export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <View
        style={[
          styles.box,
          { borderColor: checked ? theme.text : theme.textSecondary, backgroundColor: checked ? theme.text : 'transparent' },
        ]}>
        {checked && <Icon name="checkmark" size={16} color={theme.background} fallback="✓" />}
      </View>
      <ThemedText style={styles.label}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 48, paddingVertical: Spacing.one },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
});
