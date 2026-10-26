import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { SettingsRow } from '@/features/settings/settings-row';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/theme';

type Item = { icon: SFSymbol; title: string; onPress: () => void };

/** Få hjelp (som i Lyfta): feil, forslag, support, ofte stilte spørsmål og retningslinjene. */
export default function HelpSettings() {
  const theme = useTheme();
  const write = (kind: 'BUG' | 'IDEA' | 'SUPPORT') => router.push({ pathname: '/settings/feedback', params: { kind } });
  const items: Item[] = [
    { icon: 'exclamationmark.circle', title: 'Rapporter en feil', onPress: () => write('BUG') },
    { icon: 'lightbulb', title: 'Foreslå en funksjon', onPress: () => write('IDEA') },
    { icon: 'envelope', title: 'Kontakt support', onPress: () => write('SUPPORT') },
    { icon: 'questionmark.circle', title: 'Ofte stilte spørsmål', onPress: () => router.push('/settings/faq') },
    {
      icon: 'person.2',
      title: 'Retningslinjer for community',
      onPress: () => router.push({ pathname: '/legal/[doc]', params: { doc: 'retningslinjer' } }),
    },
  ];
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      {items.map((item) => (
        <View key={item.title} style={[styles.divider, { borderBottomColor: theme.backgroundSelected }]}>
          <SettingsRow icon={item.icon} title={item.title} onPress={item.onPress} chevron />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.one },
});
