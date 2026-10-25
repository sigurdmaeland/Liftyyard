import { Alert, Pressable, StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/theme';
import { VISIBILITY_DESCRIPTIONS, VISIBILITY_LABELS, type WorkoutVisibility } from '@/types/workout';

export const VISIBILITY_ICONS: Record<WorkoutVisibility, SFSymbol> = {
  PUBLIC: 'globe',
  FOLLOWERS: 'person.2.fill',
  PRIVATE: 'lock.fill',
};

const ORDER: WorkoutVisibility[] = ['FOLLOWERS', 'PUBLIC', 'PRIVATE'];

/**
 * Rad som viser hvem som ser noe (en økt, et program, en rutine). Trykk for å velge Følgere,
 * Offentlig eller Bare meg. title og descriptions tilpasser tekstene (standard: økter).
 */
export function VisibilityPicker({
  value,
  onChange,
  title = 'Hvem kan se økten?',
  descriptions = VISIBILITY_DESCRIPTIONS,
  order = ORDER,
}: {
  value: WorkoutVisibility;
  onChange: (v: WorkoutVisibility) => void;
  title?: string;
  descriptions?: Record<WorkoutVisibility, string>;
  order?: WorkoutVisibility[];
}) {
  const theme = useTheme();
  const choose = () =>
    Alert.alert(title, undefined, [
      ...order.map((v) => ({ text: `${VISIBILITY_LABELS[v]} – ${descriptions[v].toLowerCase()}`, onPress: () => onChange(v) })),
      { text: 'Avbryt', style: 'cancel' as const },
    ]);
  return (
    <Pressable
      onPress={choose}
      accessibilityRole="button"
      accessibilityLabel={`Synlighet: ${VISIBILITY_LABELS[value]}. Trykk for å endre.`}
      style={[styles.row, { borderColor: theme.backgroundSelected }]}>
      <Icon name={VISIBILITY_ICONS[value]} color={theme.textSecondary} fallback="👁" />
      <View style={styles.text}>
        <ThemedText>{VISIBILITY_LABELS[value]}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {descriptions[value]}
        </ThemedText>
      </View>
      <Icon name="chevron.up.chevron.down" size={16} color={theme.textSecondary} fallback="⇅" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, minHeight: 60 },
  text: { flex: 1 },
});
