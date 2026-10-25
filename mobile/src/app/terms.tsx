import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LEGAL_DOCUMENTS, type LegalDocId, TERMS_VERSION } from '@/features/legal/documents';
import { refreshProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { acceptTerms } from '@/services/safety';
import { applyServerProfile } from '@/storage/profile-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';

/**
 * Før appen tas i bruk (og når vilkårene endres): kort oppsummering, lenker til hele tekstene,
 * bekreftelse av minstealder og samtykke. Ingenting er forhåndsavkrysset.
 */
export default function TermsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [age, setAge] = useState(false);
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setSaving(true);
    setError(null);
    try {
      await applyServerProfile(db, await acceptTerms(TERMS_VERSION));
      await refreshProfile(db);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noe gikk galt. Prøv igjen.');
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText accessibilityRole="header" style={styles.title}>
            Før du begynner
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.lead}>
            Les gjennom det viktigste om hvordan appen fungerer og hvordan vi tar vare på dataene dine.
          </ThemedText>

          <View style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
            <Point icon="lock.fill" text="Du bestemmer hvem som ser øktene, programmene og rutinene dine." />
            <Point icon="heart.fill" text="Vær støttende. Trakassering, hat og farlig innhold er ikke tillatt." />
            <Point icon="flag.fill" text="Du kan rapportere innhold og blokkere brukere når som helst." />
            <Point icon="trash.fill" text="Du kan slette kontoen og alle dataene dine under Innstillinger." />
          </View>

          <View style={styles.links}>
            {(['vilkar', 'personvern', 'retningslinjer'] as LegalDocId[]).map((id) => (
              <Pressable
                key={id}
                onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: id } })}
                accessibilityRole="link"
                style={({ pressed }) => [styles.link, { borderBottomColor: theme.backgroundSelected, opacity: pressed ? 0.6 : 1 }]}>
                <ThemedText style={[styles.flex, { color: theme.accent }]}>Les {LEGAL_DOCUMENTS[id].title.toLowerCase()}</ThemedText>
                <Icon name="chevron.right" size={14} color={theme.textSecondary} fallback="›" />
              </Pressable>
            ))}
          </View>

          <Checkbox checked={age} onChange={setAge} label="Jeg er minst 13 år" />
          <Checkbox checked={agree} onChange={setAgree} label="Jeg godtar vilkårene, personvernerklæringen og retningslinjene" />

          {error && (
            <ThemedText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: theme.danger }}>
              {error}
            </ThemedText>
          )}
          <Button label="Godta og fortsett" onPress={accept} disabled={!age || !agree} loading={saving} />
          {(!age || !agree) && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Kryss av begge boksene for å fortsette.
            </ThemedText>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Point({ icon, text }: { icon: Parameters<typeof Icon>[0]['name']; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.point}>
      <Icon name={icon} size={18} color={theme.text} fallback="•" />
      <ThemedText style={styles.flex}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  title: { fontSize: 28, lineHeight: 36, fontWeight: 700, marginTop: Spacing.three },
  lead: { fontSize: 17, lineHeight: 24 },
  box: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.three },
  point: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  links: { marginBottom: Spacing.two },
  link: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
});
