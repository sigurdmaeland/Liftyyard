import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/theme';

type Props = {
  icon?: SFSymbol;
  /** Vises i stedet for ikon (f.eks. forbokstaver). */
  initials?: string;
  /** Bilde som fyller flisen (f.eks. programmets forsidebilde). Går foran ikon og forbokstaver. */
  imageUri?: string | null;
  title: string;
  subtitle?: string;
  onPress: () => void;
  tileColor?: string;
  /** Rutenettvisning: stor flis med tekst under. */
  grid?: boolean;
  right?: React.ReactNode;
};

/** Bibliotekrad (som Spotify): kvadratisk flis med ikon, tittel og undertittel. */
export function ListTile({ icon, initials, imageUri, title, subtitle, onPress, tileColor, grid, right }: Props) {
  const theme = useTheme();
  const tile = (
    <View style={[grid ? styles.gridTile : styles.tile, { backgroundColor: tileColor ?? theme.tile }]}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : initials ? (
        <ThemedText style={[styles.initials, { color: '#FFFFFF' }]}>{initials}</ThemedText>
      ) : (
        icon && <Icon name={icon} size={grid ? 40 : 30} color={tileColor ? '#FFFFFF' : theme.text} fallback="•" />
      )}
    </View>
  );
  if (grid) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.gridItem, { opacity: pressed ? 0.6 : 1 }]}>
        {tile}
        <ThemedText style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        )}
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      {tile}
      <View style={styles.text}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        )}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  tile: { width: 68, height: 68, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  gridItem: { width: '47%', gap: 4, marginBottom: Spacing.three },
  gridTile: { aspectRatio: 1, width: '100%', borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center', marginBottom: 4, overflow: 'hidden' },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: 500 },
  initials: { fontSize: 22, fontWeight: 700 },
});
