import { SymbolView } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { ThemedText } from '@/components/themed-text';

/**
 * Systemikoner: SF Symbols på iOS. På Android vises en enkel reservetegn-variant
 * frem til vi tar i bruk Material Symbols (krever development build).
 */
export function Icon({
  name,
  size = 22,
  color,
  fallback = '•',
  style,
}: {
  name: SFSymbol;
  size?: number;
  color: ColorValue;
  fallback?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SymbolView
      name={{ ios: name }}
      size={size}
      tintColor={color}
      style={[{ width: size, height: size }, style]}
      fallback={<ThemedText style={{ color, fontSize: size * 0.8, lineHeight: size }}>{fallback}</ThemedText>}
    />
  );
}
