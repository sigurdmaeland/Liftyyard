import { Pressable, StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme';

export type SheetAction = {
  key: string;
  label: string;
  icon: SFSymbol;
  onPress: () => void;
  destructive?: boolean;
};

/** Liste med handlinger i et ark: rund ikonknapp og tekst (som i Lyfta). */
export function SheetActions({ title, actions }: { title?: string; actions: SheetAction[] }) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {title && (
        <View style={[styles.titleRow, { borderBottomColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold" style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
        </View>
      )}
      {actions.map((a) => {
        const color = a.destructive ? theme.danger : theme.text;
        return (
          <Pressable
            key={a.key}
            onPress={a.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
            <View style={[styles.iconCircle, { backgroundColor: theme.backgroundSelected }]}>
              <Icon name={a.icon} color={color} size={20} />
            </View>
            <ThemedText type="smallBold" style={[styles.label, { color }]}>
              {a.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: Spacing.three, paddingBottom: Spacing.five, paddingHorizontal: Spacing.three },
  titleRow: { alignItems: 'center', paddingBottom: Spacing.three, marginBottom: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 17 },
});
