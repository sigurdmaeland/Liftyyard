import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/**
 * Kalenderikon tegnet selv, slik at «i dag» (med dato) og «kalender» (med rutenett)
 * blir nøyaktig like store. size er bredde og høyde i punkter.
 */
export function CalendarGlyph({ day, size = 28 }: { day?: number; size?: number }) {
  const theme = useTheme();
  const dot = { width: size * 0.12, height: size * 0.12, borderRadius: size * 0.06, backgroundColor: theme.text };
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size * 0.22, borderColor: theme.text, borderWidth: size * 0.07 }]}>
      <View style={[styles.top, { height: size * 0.18, backgroundColor: theme.text }]} />
      {day !== undefined ? (
        <ThemedText style={[styles.day, { fontSize: size * 0.42, lineHeight: size * 0.6 }]}>{day}</ThemedText>
      ) : (
        <View style={[styles.grid, { gap: size * 0.08, paddingTop: size * 0.1 }]}>
          {[0, 1].map((r) => (
            <View key={r} style={[styles.gridRow, { gap: size * 0.1 }]}>
              {[0, 1, 2].map((c) => (
                <View key={c} style={dot} />
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', overflow: 'hidden' },
  top: { alignSelf: 'stretch' },
  day: { fontWeight: 700, textAlign: 'center' },
  grid: { alignItems: 'center' },
  gridRow: { flexDirection: 'row' },
});
