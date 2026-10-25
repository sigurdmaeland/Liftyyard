import { Pressable, StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/theme';

/** Hvitt kort med ikon, tittel, undertekst og pil (som i Lyftas Trening-fane). */
export function ActionCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: SFSymbol;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, { backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }]}>
      <Icon name={icon} size={30} color={theme.accent} fallback="›" />
      <View style={styles.text}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
      </View>
      <Icon name="chevron.right" size={18} color={theme.textSecondary} fallback="›" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    padding: Spacing.four,
    borderRadius: Radius.large,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: 600 },
});
