import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme';

const SIZE = 220;

/** Vises for tidligere dager uten økter: måne med sirkelbuer rundt og en kort tekst. */
export function RestDay() {
  const theme = useTheme();
  const c = SIZE / 2;
  // Brutte buer rundt ikonet (strek med mellomrom), som et rolig «pust».
  const arcs = [
    { r: 72, dash: '60 18', opacity: 0.45 },
    { r: 92, dash: '90 30', opacity: 0.25 },
  ];
  return (
    <View style={styles.container} accessible accessibilityLabel="Hviledag gjennomført. Restitusjon gjør deg klar for neste økt.">
      <View style={styles.art}>
        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
          {arcs.map((a) => (
            <Circle
              key={a.r}
              cx={c}
              cy={c}
              r={a.r}
              fill="none"
              stroke={theme.accent}
              strokeOpacity={a.opacity}
              strokeWidth={2}
              strokeDasharray={a.dash}
              strokeLinecap="round"
              rotation={-30}
              origin={`${c}, ${c}`}
            />
          ))}
          <Circle cx={c} cy={c} r={52} fill={theme.accent} fillOpacity={0.18} />
        </Svg>
        <Icon name="moon.zzz.fill" size={44} color={theme.accent} fallback="☾" />
      </View>
      <ThemedText accessibilityRole="header" style={styles.title}>Hviledag gjennomført</ThemedText>
      <ThemedText style={styles.subtitle}>Restitusjon gjør deg klar for neste økt.</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: Spacing.five, gap: Spacing.two },
  art: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 700, textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center' },
});
