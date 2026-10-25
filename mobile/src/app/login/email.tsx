import { useSQLiteContext } from 'expo-sqlite';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { completeLogin } from '@/features/auth/account';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/services/api';
import { startEmailLogin, verifyEmailLogin } from '@/services/auth';
import { MaxContentWidth, Radius, Spacing } from '@/theme';

const RESEND_SECONDS = 30;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function message(e: unknown): string {
  if (e instanceof ApiError && e.isNetworkError) return 'Fikk ikke kontakt med serveren. Sjekk nettet og prøv igjen.';
  return e instanceof Error ? e.message : 'Noe gikk galt';
}

/** «Fortsett med e-post»: skriv e-post, få en sekssifret kode, skriv inn koden. Ingen passord. */
export default function EmailLoginScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeInput = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const validEmail = EMAIL.test(email.trim());

  const sendCode = async () => {
    if (!validEmail || busy) return;
    setBusy(true);
    setError(null);
    try {
      await startEmailLogin(email.trim());
      setStep('code');
      setCode('');
      setCooldown(RESEND_SECONDS);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await completeLogin(db, await verifyEmailLogin(email.trim(), value));
      // Innlogget: rotoppsettet bytter til appen av seg selv.
    } catch (e) {
      setError(message(e));
      setCode('');
      setBusy(false);
      codeInput.current?.focus();
    }
  };

  const onCodeChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) verify(digits);
  };

  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        {step === 'email' ? (
          <>
            <ThemedText accessibilityRole="header" style={styles.title}>Hva er e-posten din?</ThemedText>
            <ThemedText themeColor="textSecondary">Vi sender deg en kode for å logge inn. Har du ikke konto, lager vi en.</ThemedText>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="navn@eksempel.no"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              autoFocus
              returnKeyType="send"
              onSubmitEditing={sendCode}
              accessibilityLabel="E-post"
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />
          </>
        ) : (
          <>
            <ThemedText accessibilityRole="header" style={styles.title}>Skriv inn koden</ThemedText>
            <ThemedText themeColor="textSecondary">
              Vi har sendt en sekssifret kode til {email.trim()}. Den gjelder i 10 minutter.
            </ThemedText>
            <TextInput
              ref={codeInput}
              value={code}
              onChangeText={onCodeChange}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              editable={!busy}
              accessibilityLabel="Kode fra e-posten"
              style={[styles.input, styles.codeInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />
            <View style={styles.links}>
              <Pressable onPress={sendCode} disabled={cooldown > 0 || busy} accessibilityRole="button">
                <ThemedText type="smallBold" style={{ color: cooldown > 0 ? theme.textSecondary : theme.accent }}>
                  {cooldown > 0 ? `Send ny kode om ${cooldown} s` : 'Send ny kode'}
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => setStep('email')} accessibilityRole="button">
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  Bytt e-post
                </ThemedText>
              </Pressable>
            </View>
          </>
        )}

        {error && (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        )}

        <View style={styles.spacer} />
        {step === 'email' ? (
          <Pressable
            onPress={sendCode}
            disabled={!validEmail || busy}
            accessibilityRole="button"
            style={[styles.button, { backgroundColor: theme.text, opacity: !validEmail || busy ? 0.4 : 1 }]}>
            {busy ? <ActivityIndicator color={theme.background} /> : <ThemedText style={[styles.buttonLabel, { color: theme.background }]}>Send kode</ThemedText>}
          </Pressable>
        ) : (
          busy && <ActivityIndicator style={styles.loading} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flex: 1, padding: Spacing.four, paddingTop: 110, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 800 },
  input: { borderWidth: 1.5, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, minHeight: 56, fontSize: 18, marginTop: Spacing.two },
  codeInput: { fontSize: 28, letterSpacing: 12, textAlign: 'center', fontVariant: ['tabular-nums'], fontWeight: 700 },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  spacer: { flex: 1 },
  button: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.three },
  buttonLabel: { fontSize: 17, fontWeight: 700 },
  loading: { marginBottom: Spacing.five },
});
