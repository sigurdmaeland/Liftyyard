import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const DAY_LETTERS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Ukestripe mandag–søndag. Dager med økter er fylt med blått, i dag er markert,
 * og valgt dag har grå ring. Fremtidige dager kan ikke velges.
 */
export function WeekStrip({
  weekStart,
  trainedDays,
  selected,
  onSelect,
  today = new Date(),
}: {
  weekStart: Date;
  trainedDays: Set<string>;
  selected: Date;
  onSelect: (d: Date) => void;
  today?: Date;
}) {
  const theme = useTheme();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <View style={styles.row}>
      {days.map((d, i) => {
        const isToday = sameDay(d, today);
        const isSelected = sameDay(d, selected);
        const trained = trainedDays.has(d.toDateString());
        const future = d.getTime() > today.getTime() && !isToday;
        const color = trained ? '#FFFFFF' : future ? theme.textSecondary : theme.text;
        return (
          <Pressable
            key={i}
            disabled={future}
            onPress={() => onSelect(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled: future }}
            accessibilityLabel={`${d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}${trained ? ', trent' : ''}`}
            style={styles.day}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.letter}>
              {isToday ? 'I DAG' : DAY_LETTERS[i]}
            </ThemedText>
            {/* Valgt dag får en større grå sirkel rundt seg; treningsdager er fylt med blått. */}
            <View style={[styles.halo, { backgroundColor: isSelected ? theme.backgroundSelected : 'transparent' }]}>
              <View style={[styles.circle, { backgroundColor: trained ? theme.accentFill : 'transparent' }]}>
                <ThemedText style={[styles.date, { color }]}>{d.getDate()}</ThemedText>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 4, flex: 1 },
  letter: { fontSize: 12, letterSpacing: 0.5 },
  // Målt etter Lyfta: indre sirkel ca. 36 pt og valgt-ring ca. 48 pt, så det blir luft mellom dagene.
  halo: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  date: { fontSize: 18, lineHeight: 22, fontWeight: 500, fontVariant: ['tabular-nums'] },
});
