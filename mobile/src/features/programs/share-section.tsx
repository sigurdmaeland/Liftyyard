import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LEVEL_LABELS } from '@/features/explore/program-cover';
import { SHARE_DESCRIPTIONS, SHARE_ORDER } from '@/features/explore/share';
import { VisibilityPicker } from '@/features/workout/visibility-picker';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme';
import type { Level } from '@/types/explore';
import type { ShareVisibility } from '@/types/program';

const LEVELS: Level[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const DAYS = [1, 2, 3, 4, 5, 6, 7];

/** «Deling» for programmer og frittstående rutiner: hvem som kan finne og laste ned. */
export function ShareSection({
  kind,
  visibility,
  onVisibility,
  facts,
}: {
  kind: 'program' | 'rutine';
  visibility: ShareVisibility;
  onVisibility: (v: ShareVisibility) => void;
  /** Bare for programmer: nivå og dager per uke vises på kortet i Utforsk. */
  facts?: { level: Level | null; daysPerWeek: number | null; onChange: (level: Level | null, days: number | null) => void };
}) {
  return (
    <View style={styles.section}>
      <ThemedText accessibilityRole="header" style={styles.title}>Deling</ThemedText>
      <VisibilityPicker
        value={visibility}
        onChange={onVisibility}
        title={kind === 'program' ? 'Hvem kan se programmet?' : 'Hvem kan se rutinen?'}
        descriptions={SHARE_DESCRIPTIONS}
        order={SHARE_ORDER}
      />
      {visibility !== 'PRIVATE' && (
        <ThemedText type="small" themeColor="textSecondary">
          {kind === 'program'
            ? 'Andre får en egen kopi når de laster ned. Endringene dine etterpå påvirker ikke kopiene deres.'
            : 'Andre får en egen kopi når de laster ned rutinen.'}
        </ThemedText>
      )}
      {facts && visibility !== 'PRIVATE' && (
        <>
          <ThemedText type="smallBold" style={styles.label}>
            Nivå
          </ThemedText>
          <ChipRow
            items={LEVELS.map((l) => ({ key: l, label: LEVEL_LABELS[l], selected: facts.level === l }))}
            onPress={(key) => facts.onChange(facts.level === key ? null : (key as Level), facts.daysPerWeek)}
          />
          <ThemedText type="smallBold" style={styles.label}>
            Dager per uke
          </ThemedText>
          <ChipRow
            items={DAYS.map((d) => ({ key: String(d), label: String(d), selected: facts.daysPerWeek === d }))}
            onPress={(key) => facts.onChange(facts.level, facts.daysPerWeek === Number(key) ? null : Number(key))}
          />
        </>
      )}
    </View>
  );
}

function ChipRow({ items, onPress }: { items: { key: string; label: string; selected: boolean }[]; onPress: (key: string) => void }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {items.map((i) => (
        <Pressable
          key={i.key}
          onPress={() => onPress(i.key)}
          accessibilityRole="button"
          accessibilityState={{ selected: i.selected }}
          style={[styles.chip, { backgroundColor: i.selected ? theme.text : theme.backgroundElement }]}>
          <ThemedText type="smallBold" style={{ color: i.selected ? theme.background : theme.text }}>
            {i.label}
          </ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  title: { fontSize: 22, lineHeight: 28, fontWeight: 700, marginTop: Spacing.three },
  label: { marginTop: Spacing.two },
  chips: { gap: Spacing.two },
  chip: { minWidth: 44, minHeight: 40, borderRadius: 18, paddingHorizontal: Spacing.three, alignItems: 'center', justifyContent: 'center' },
});
