import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { LiftyardMark } from '@/components/liftyard-mark';
import { ThemedText } from '@/components/themed-text';
import { BackendStatusCard } from '@/features/home/backend-status-card';
import { SettingsRow, SettingsSection } from '@/features/settings/settings-row';
import { APP_VERSION } from '@/features/settings/support';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/theme';

/** Om Liftyard: versjon, vilkår og personvern. Serverstatus vises bare i utviklerversjonen. */
export default function AboutSettings() {
  const theme = useTheme();
  const doc = (d: string) => router.push({ pathname: '/legal/[doc]', params: { doc: d } });
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <View style={styles.brand}>
        <View style={[styles.logo, { borderColor: theme.backgroundSelected }]}>
          <LiftyardMark size={52} color="#FFFFFF" barColor={theme.accentFill} label="Liftyard" />
        </View>
        <ThemedText style={styles.name}>Liftyard</ThemedText>
        <ThemedText themeColor="textSecondary">Versjon {APP_VERSION}</ThemedText>
      </View>

      <SettingsSection>
        <SettingsRow icon="doc.text" title="Vilkår for bruk" onPress={() => doc('vilkar')} chevron />
        <SettingsRow icon="hand.raised" title="Personvernerklæring" onPress={() => doc('personvern')} chevron />
        <SettingsRow icon="person.2" title="Retningslinjer for community" onPress={() => doc('retningslinjer')} chevron />
      </SettingsSection>

      {__DEV__ && (
        <SettingsSection title="Utvikler">
          <BackendStatusCard />
        </SettingsSection>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  brand: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.four },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#0B0D10',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  name: { fontSize: 24, lineHeight: 30, fontWeight: 800 },
});
