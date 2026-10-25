import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber, parseDecimal } from '@/lib/format';
import { PLATE_COLORS, type Plate, platesFor } from '@/lib/plates';
import { Radius, Spacing } from '@/theme';

const BARS = [20, 15, 10] as const;
const PLATE_HEIGHT: Record<Plate, number> = { 25: 110, 20: 110, 15: 100, 10: 86, 5: 66, 2.5: 54, 1.25: 44 };
const PLATE_WIDTH: Record<Plate, number> = { 25: 18, 20: 16, 15: 14, 10: 12, 5: 10, 2.5: 8, 1.25: 7 };

/** Skivekalkulator: skriv målvekten, se hvilke skiver som skal på hver side av stanga. */
export default function PlatesSheet() {
  const { weight } = useLocalSearchParams<{ weight?: string }>();
  const theme = useTheme();
  const [text, setText] = useState(weight ?? '');
  const [bar, setBar] = useState<(typeof BARS)[number]>(20);
  const target = parseDecimal(text);
  const result = target !== null ? platesFor(target, bar) : null;
  const summary = result
    ? result.perSide.length === 0
      ? 'Bare stanga'
      : `${result.perSide.map((p) => formatNumber(p)).join(' + ')} kg på hver side`
    : 'Skriv inn vekten';

  return (
    <ThemedView style={styles.sheet}>
      <ThemedText accessibilityRole="header" style={styles.title}>
        Skivekalkulator
      </ThemedText>
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          placeholder="100"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Målvekt i kilo"
          autoFocus={!weight}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
        <ThemedText style={styles.unit}>kg</ThemedText>
      </View>

      <View style={styles.bars} accessibilityRole="radiogroup" accessibilityLabel="Stangvekt">
        {BARS.map((b) => (
          <Pressable
            key={b}
            onPress={() => setBar(b)}
            accessibilityRole="radio"
            accessibilityState={{ checked: bar === b }}
            accessibilityLabel={`Stang ${b} kilo`}
            style={[styles.chip, { backgroundColor: bar === b ? theme.text : theme.backgroundElement }]}>
            <ThemedText type="smallBold" style={{ color: bar === b ? theme.background : theme.text }}>
              Stang {b} kg
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.barbell} accessible accessibilityLabel={summary}>
        <View style={[styles.sleeve, { backgroundColor: theme.textSecondary }]} />
        {result?.perSide.map((p, i) => (
          <View
            key={i}
            style={[
              styles.plate,
              { height: PLATE_HEIGHT[p], width: PLATE_WIDTH[p], backgroundColor: PLATE_COLORS[p], borderColor: theme.backgroundSelected },
            ]}
          />
        ))}
        <View style={[styles.collar, { backgroundColor: theme.textSecondary }]} />
      </View>

      <ThemedText style={styles.summary}>{summary}</ThemedText>
      {result && result.remainder > 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Nærmeste du får med vanlige skiver er {formatNumber(result.achieved)} kg ({formatNumber(result.remainder)} kg mindre).
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.five },
  title: { fontSize: 22, lineHeight: 28, fontWeight: 700, textAlign: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  input: { minWidth: 140, minHeight: 56, borderRadius: Radius.medium, fontSize: 34, fontWeight: 800, textAlign: 'center', paddingHorizontal: Spacing.three },
  unit: { fontSize: 22, fontWeight: 700 },
  bars: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  chip: { minHeight: 40, paddingHorizontal: Spacing.three, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  barbell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 120, gap: 2 },
  sleeve: { width: 70, height: 10, borderRadius: 3 },
  plate: { borderRadius: 3, borderWidth: StyleSheet.hairlineWidth },
  collar: { width: 26, height: 10, borderRadius: 3 },
  summary: { fontSize: 18, fontWeight: 700, textAlign: 'center' },
  center: { textAlign: 'center' },
});
