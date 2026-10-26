import { ScrollView, StyleSheet } from 'react-native';

import { APPEARANCE_OPTIONS, setAppearance, useAppearancePref } from '@/features/settings/appearance';
import { ChoiceRow, SettingsSection } from '@/features/settings/settings-row';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/theme';

const DESCRIPTIONS = { system: 'Følger lys eller mørk modus på telefonen', light: 'Alltid lyst', dark: 'Alltid mørkt' } as const;

/** Tema: automatisk (følger telefonen), lys eller mørk. Valget huskes på telefonen. */
export default function ThemeSettings() {
  const theme = useTheme();
  const pref = useAppearancePref();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <SettingsSection first>
        {APPEARANCE_OPTIONS.map((o) => (
          <ChoiceRow key={o.value} label={o.label} description={DESCRIPTIONS[o.value]} selected={pref === o.value} onPress={() => setAppearance(o.value)} />
        ))}
      </SettingsSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
