import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { showToast } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';
import { uuidv7 } from '@/lib/ids';
import { ApiError } from '@/services/api';
import { type FeedbackKind, sendFeedback } from '@/services/feedback';
import { MaxContentWidth, Radius, Spacing } from '@/theme';

const TEXT: Record<FeedbackKind, { title: string; intro: string; placeholder: string; sent: string }> = {
  BUG: {
    title: 'Rapporter en feil',
    intro: 'Hva skjedde, og hva gjorde du rett før? Jo mer konkret, jo lettere er det å rette.',
    placeholder: 'F.eks. «Appen lukket seg da jeg trykket Fullfør etter en økt med supersett.»',
    sent: 'Takk! Vi ser på feilen.',
  },
  IDEA: {
    title: 'Foreslå en funksjon',
    intro: 'Hva skulle du ønske at Liftyard kunne? Fortell gjerne hvorfor det ville hjulpet deg.',
    placeholder: 'F.eks. «Kunne sett fremgangen på knebøy måned for måned.»',
    sent: 'Takk for forslaget!',
  },
  SUPPORT: {
    title: 'Kontakt support',
    intro: 'Skriv hva du trenger hjelp med. Vi svarer til e-postadressen du logget inn med.',
    placeholder: 'Spørsmålet ditt …',
    sent: 'Meldingen er sendt. Vi svarer på e-post.',
  },
};

/** Skjema for «Få hjelp»: sendes til Liftyard sammen med appversjon og system. */
export default function FeedbackScreen() {
  const { kind: raw } = useLocalSearchParams<{ kind?: string }>();
  const kind: FeedbackKind = raw === 'IDEA' || raw === 'SUPPORT' ? raw : 'BUG';
  const t = TEXT[kind];
  const theme = useTheme();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  // Samme ID ved nytt forsøk, så serveren ikke lagrer meldingen to ganger.
  const id = useRef(uuidv7());

  const send = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await sendFeedback(kind, message.trim(), id.current);
      showToast({ title: t.sent, icon: 'checkmark.circle.fill' });
      router.back();
    } catch (e) {
      setSending(false);
      Alert.alert('Fikk ikke sendt', e instanceof ApiError && e.isClientError ? e.message : 'Prøv igjen når du har nett.');
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t.title }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText themeColor="textSecondary">{t.intro}</ThemedText>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder={t.placeholder}
          placeholderTextColor={theme.textSecondary}
          multiline
          autoFocus
          maxLength={4000}
          accessibilityLabel={t.title}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Appversjon og telefonens system sendes med, så vi kan finne feilen. Ingenting annet.
        </ThemedText>
        <Button label="Send" onPress={send} loading={sending} disabled={!message.trim()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  input: { minHeight: 180, fontSize: 17, lineHeight: 23, borderRadius: Radius.medium, padding: Spacing.three, textAlignVertical: 'top' },
});
