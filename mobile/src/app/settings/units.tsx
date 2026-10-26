import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ChoiceRow, SettingsSection } from '@/features/settings/settings-row';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import type { WeightUnit } from '@/lib/units';
import { syncPendingWorkouts } from '@/services/sync';
import { getSettings, setWeightUnit } from '@/storage/settings-store';
import { MaxContentWidth, Spacing } from '@/theme';

/** Vektenhet (kg/lb). Alt lagres i kg; bare visning og inntasting regnes om. */
export default function UnitSettings() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { state, reload } = useLocalQuery(getSettings);
  const unit = state.status === 'ready' ? state.data.weightUnit : null;

  const change = async (u: WeightUnit) => {
    await setWeightUnit(db, u);
    reload();
    syncPendingWorkouts(db).catch(() => {});
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <SettingsSection first title="Vekt">
        <ChoiceRow label="Kilo (kg)" selected={unit === 'KG'} onPress={() => change('KG')} />
        <ChoiceRow label="Pund (lb)" selected={unit === 'LB'} onPress={() => change('LB')} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          Gjelder sett, rutiner, volum, rekorder og kroppsvekt. Kroppsmål vises i cm. Du kan bytte når du vil uten at noe går tapt.
        </ThemedText>
      </SettingsSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  note: { marginTop: Spacing.three },
});
