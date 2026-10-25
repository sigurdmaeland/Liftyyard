import { StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme';

/**
 * Tom side: et ikon i en sirkel, en kort overskrift, én setning om hva man kan gjøre, og
 * eventuelt en knapp som gjør det.
 */
export function EmptyState({
  icon,
  title,
  text,
  action,
  secondary,
}: {
  icon: SFSymbol;
  title: string;
  text?: string;
  action?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}) {
  const theme = useTheme();
  return (
    <View style={styles.box}>
      <View style={[styles.circle, { backgroundColor: theme.backgroundElement }]}>
        <Icon name={icon} size={34} color={theme.textSecondary} fallback="•" />
      </View>
      <ThemedText accessibilityRole="header" style={styles.title}>
        {title}
      </ThemedText>
      {text && (
        <ThemedText themeColor="textSecondary" style={styles.text}>
          {text}
        </ThemedText>
      )}
      {action && <Button label={action.label} onPress={action.onPress} style={styles.button} />}
      {secondary && <Button label={secondary.label} variant="ghost" onPress={secondary.onPress} />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five, paddingHorizontal: Spacing.four },
  circle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  title: { fontSize: 20, lineHeight: 26, fontWeight: 700, textAlign: 'center' },
  text: { textAlign: 'center', maxWidth: 320 },
  button: { marginTop: Spacing.two, alignSelf: 'stretch' },
});
