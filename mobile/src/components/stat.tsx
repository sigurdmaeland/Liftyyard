import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

/** Nøkkeltall: stor verdi med liten etikett under. */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <ThemedText style={styles.value}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, gap: 2 },
  value: { fontSize: 20, lineHeight: 26, fontWeight: 700, fontVariant: ['tabular-nums'] },
});
