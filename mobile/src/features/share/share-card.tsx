import type { ComponentRef, Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/theme';

/**
 * Kvadratisk delingsbilde (som Strava-kort): mørk fargeovergang, stor tittel, nøkkeltall og
 * en liste. Tegnes med faste farger slik at bildet ser likt ut uansett lys/mørk modus.
 */
export type ShareCardRef = ComponentRef<typeof View>;

export function ShareCard({
  ref,
  eyebrow,
  title,
  stats,
  lines,
}: {
  ref?: Ref<ShareCardRef>;
  eyebrow: string;
  title: string;
  stats: { label: string; value: string }[];
  lines: string[];
}) {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#0B0D10" />
            <Stop offset="1" stopColor="#1E3A8A" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#bg)" />
      </Svg>
      <ThemedText style={styles.eyebrow}>{eyebrow}</ThemedText>
      <ThemedText style={styles.title} numberOfLines={2}>
        {title}
      </ThemedText>
      <View style={styles.stats}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <ThemedText style={styles.statValue}>{s.value}</ThemedText>
            <ThemedText style={styles.statLabel}>{s.label}</ThemedText>
          </View>
        ))}
      </View>
      <View style={styles.lines}>
        {lines.map((l) => (
          <ThemedText key={l} style={styles.line} numberOfLines={1}>
            {l}
          </ThemedText>
        ))}
      </View>
      <ThemedText style={styles.brand}>Treningsapp</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 340, height: 340, borderRadius: 24, overflow: 'hidden', padding: Spacing.four, gap: Spacing.two },
  eyebrow: { color: '#A4AAB3', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: '#FFFFFF', fontSize: 28, lineHeight: 34, fontWeight: 800 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four, marginTop: Spacing.two },
  stat: { gap: 0 },
  statValue: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: 800, fontVariant: ['tabular-nums'] },
  statLabel: { color: '#C9CED6', fontSize: 13, lineHeight: 16 },
  lines: { gap: 2, marginTop: Spacing.two, flex: 1 },
  line: { color: '#E8EAED', fontSize: 15, lineHeight: 20 },
  brand: { color: '#FFFFFF', fontSize: 14, fontWeight: 800, opacity: 0.85, alignSelf: 'flex-end' },
});
