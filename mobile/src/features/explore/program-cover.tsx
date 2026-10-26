import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import type { Level } from '@/types/explore';

/** Fargepar per program (stabilt ut fra ID). Egne omslag – ingen bilder fra andre apper. */
const GRADIENTS: [string, string][] = [
  ['#1E3A8A', '#2F6BFF'],
  ['#7F1D1D', '#E5533D'],
  ['#064E3B', '#1F9D55'],
  ['#4C1D95', '#8B5CF6'],
  ['#78350F', '#F59E2B'],
  ['#0C4A6E', '#0EA5E9'],
  ['#111827', '#4B5563'],
];

export const LEVEL_LABELS: Record<Level, string> = {
  BEGINNER: 'Nybegynner',
  INTERMEDIATE: 'Viderekommen',
  ADVANCED: 'Erfaren',
};

function gradientFor(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/**
 * Programomslag. Har programmet et forsidebilde (imageUri), vises bildet med merkelappen nederst.
 * Ellers en fargeovergang med stor tittel og merkelapp (f.eks. «3 DAGER»).
 */
export function ProgramCover({
  id,
  title,
  tag,
  size,
  radius = 16,
  imageUri,
}: {
  id: string;
  title: string;
  tag?: string;
  size: number;
  radius?: number;
  imageUri?: string | null;
}) {
  if (imageUri) {
    return (
      <View style={[styles.cover, { width: size, height: size, borderRadius: radius }]} accessible={false}>
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
        {tag && (
          <View style={[styles.tag, styles.tagOnImage]}>
            <ThemedText style={[styles.tagText, { fontSize: Math.max(10, size * 0.07) }]}>{tag}</ThemedText>
          </View>
        )}
      </View>
    );
  }
  const [from, to] = gradientFor(id);
  const gid = `g-${id}`;
  return (
    <View style={[styles.cover, { width: size, height: size, borderRadius: radius }]} accessible={false}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${gid})`} />
      </Svg>
      <View style={styles.inner}>
        <ThemedText accessibilityRole="header"
          numberOfLines={3}
          adjustsFontSizeToFit
          style={[styles.title, { fontSize: size * 0.16, lineHeight: size * 0.18 }]}>
          {title.toUpperCase()}
        </ThemedText>
        {tag && (
          <View style={styles.tag}>
            <ThemedText style={[styles.tagText, { fontSize: Math.max(10, size * 0.07) }]}>{tag}</ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { overflow: 'hidden' },
  inner: { flex: 1, padding: 12, justifyContent: 'center', alignItems: 'center', gap: 8 },
  title: { color: '#FFFFFF', fontWeight: 900, textAlign: 'center', letterSpacing: 0.5 },
  tag: { backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  tagText: { color: '#111827', fontWeight: 800, letterSpacing: 0.5 },
  tagOnImage: { position: 'absolute', left: 10, bottom: 10 },
});
