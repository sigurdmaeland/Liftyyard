import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { completeLogin } from '@/features/auth/account';
import { getGoogleIdToken, googleSignInAvailable } from '@/features/auth/google';
import { useTheme } from '@/hooks/use-theme';
import { loginWithGoogleToken } from '@/services/auth';
import { MaxContentWidth, Spacing } from '@/theme';

/** Velkomst og valg av innloggingsmetode. Apple-innlogging kommer når Apple-utviklerkontoen er på plass. */
export default function WelcomeScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const google = async () => {
    setError(null);
    setBusy(true);
    try {
      const idToken = await getGoogleIdToken();
      if (idToken) await completeLogin(db, await loginWithGoogleToken(idToken));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Innloggingen feilet');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.logo, { backgroundColor: theme.text }]}>
            <Icon name="dumbbell.fill" size={44} color={theme.background} fallback="🏋" />
          </View>
          <ThemedText accessibilityRole="header" style={styles.title}>
            Treningsapp
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Logg øktene dine, følg fremgangen og tren sammen med andre.
          </ThemedText>
        </View>

        <View style={styles.buttons}>
          {error && (
            <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
              {error}
            </ThemedText>
          )}
          {googleSignInAvailable && (
            <Pressable
              onPress={google}
              disabled={busy}
              accessibilityRole="button"
              style={[styles.button, { backgroundColor: theme.text, opacity: busy ? 0.6 : 1 }]}>
              {busy ? (
                <ActivityIndicator color={theme.background} />
              ) : (
                <>
                  <ThemedText style={[styles.googleG, { color: theme.background }]}>G</ThemedText>
                  <ThemedText style={[styles.buttonLabel, { color: theme.background }]}>Fortsett med Google</ThemedText>
                </>
              )}
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push('/login/email')}
            disabled={busy}
            accessibilityRole="button"
            style={[
              styles.button,
              googleSignInAvailable ? { borderWidth: 1.5, borderColor: theme.backgroundSelected } : { backgroundColor: theme.text },
            ]}>
            <Icon name="envelope.fill" size={18} color={googleSignInAvailable ? theme.text : theme.background} fallback="✉" />
            <ThemedText style={[styles.buttonLabel, { color: googleSignInAvailable ? theme.text : theme.background }]}>
              Fortsett med e-post
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flex: 1, justifyContent: 'space-between', padding: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  logo: { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  title: { fontSize: 34, lineHeight: 40, fontWeight: 800 },
  subtitle: { fontSize: 17, lineHeight: 24, textAlign: 'center', maxWidth: 300 },
  buttons: { gap: Spacing.three, paddingBottom: Spacing.three },
  button: { minHeight: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  buttonLabel: { fontSize: 17, fontWeight: 700 },
  googleG: { fontSize: 20, fontWeight: 800 },
  error: { textAlign: 'center' },
});
