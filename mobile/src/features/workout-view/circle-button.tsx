import { Pressable, StyleSheet } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Icon } from '@/components/icon';
import { useTheme } from '@/hooks/use-theme';

/** Rund knapp som ligger over et bilde (tilbake, valg). Halvgjennomsiktig bakgrunn gir kontrast mot bildet. */
export function CircleButton({ icon, label, onPress }: { icon: SFSymbol; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.button, { backgroundColor: `${theme.background}CC`, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={icon} size={20} color={theme.text} fallback="•" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
