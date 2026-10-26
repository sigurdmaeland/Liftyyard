import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';

import { loadSession, useAuth } from '@/services/auth-session';
import { refreshExerciseCatalog, syncPendingWorkouts } from '@/services/sync';
import { DATABASE_NAME, migrateDatabase } from '@/storage/database';
import { ToastHost } from '@/components/toast';
import { initAppearance } from '@/features/settings/appearance';
import { Colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
// Lys/mørk/automatisk fra innstillingene settes før første skjerm tegnes.
initAppearance();

/** Henter katalogen og laster opp ventende endringer ved oppstart og når appen kommer i forgrunnen. Bare innlogget. */
function BackgroundSync() {
  const db = useSQLiteContext();
  useEffect(() => {
    const run = () => {
      refreshExerciseCatalog(db).catch(() => {});
      syncPendingWorkouts(db).catch(() => {});
    };
    run();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && run());
    return () => sub.remove();
  }, [db]);
  return null;
}

/**
 * Rotnavigasjon: fanene ligger nederst, og detaljskjermer og aktiv økt legges oppå.
 * Den aktive økten vises i fullskjerm uten fanelinje, slik at man kan konsentrere seg om treningen.
 */
/** Krasjer en skjerm, vises en vennlig feilside (og feilen rapporteres) i stedet for hvit skjerm. */
export { ErrorScreen as ErrorBoundary } from '@/features/errors/error-screen';

/** Navigasjonsfarger (topplinje, bakgrunn bak skjermer, skillelinjer) fra appens egne farger, så de stemmer i begge moduser. */
const navTheme = (mode: 'light' | 'dark') => {
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const c = Colors[mode];
  return {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.background, card: c.background, text: c.text, border: c.backgroundSelected },
  };
};
const NAV_THEMES = { light: navTheme('light'), dark: navTheme('dark') };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const auth = useAuth();
  useEffect(() => {
    loadSession();
  }, []);
  // Oppstartsbildet står til vi vet om brukeren er innlogget, så innloggingsskjermen ikke blinker forbi.
  useEffect(() => {
    if (auth.status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [auth.status]);
  const signedIn = auth.status === 'signedIn';
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}>
      <ThemeProvider value={NAV_THEMES[colorScheme === 'dark' ? 'dark' : 'light']}>
        {signedIn && <BackgroundSync />}
        <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
          {/* Fanene sender til innlogging uten innlogging, og innloggingen sender til fanene etterpå. */}
          <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="user/[username]/index" options={{ title: '' }} />
        <Stack.Screen name="user/[username]/followers" options={{ title: 'Følgere' }} />
        <Stack.Screen name="user/[username]/following" options={{ title: 'Følger' }} />
        <Stack.Screen name="post/[id]/index" options={{ title: 'Økt' }} />
        <Stack.Screen name="post/[id]/likes" options={{ title: 'Liker' }} />
        <Stack.Screen name="post/[id]/comments" options={{ title: 'Kommentarer' }} />
        <Stack.Screen name="history/partners" options={{ presentation: 'modal', title: 'Trente med' }} />
        <Stack.Screen name="share/workout" options={{ presentation: 'modal', title: 'Del økten' }} />
        <Stack.Screen name="me/month" options={{ title: 'Månedsoppsummering' }} />
        <Stack.Screen name="notifications" options={{ title: 'Varsler' }} />
        <Stack.Screen name="me/requests" options={{ title: 'Følgeforespørsler' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="workout"
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen name="history/index" options={{ title: 'Historikk' }} />
          <Stack.Screen name="history/[id]" options={{ title: 'Økt' }} />
          <Stack.Screen name="exercise/[id]" options={{ title: 'Øvelse' }} />
          <Stack.Screen name="program/[id]" options={{ title: '' }} />
          <Stack.Screen name="program/edit" options={{ title: 'Rediger program' }} />
          <Stack.Screen name="routine/[id]" options={{ title: '' }} />
          <Stack.Screen name="routine/add-exercise" options={{ presentation: 'modal', title: 'Legg til øvelse' }} />
          <Stack.Screen
            name="library/create"
            options={{
              presentation: 'formSheet',
              headerShown: false,
              sheetGrabberVisible: true,
              sheetAllowedDetents: 'fitToContents',
            }}
          />
          <Stack.Screen name="favorites/index" options={{ title: '' }} />
          <Stack.Screen
            name="favorites/add"
            options={{
              presentation: 'modal',
              title: 'Legg til i favoritter',
            }}
          />
          <Stack.Screen name="exercises/favorites" options={{ title: 'Favorittøvelser' }} />
          <Stack.Screen name="exercises/custom" options={{ title: 'Egendefinerte øvelser' }} />
          <Stack.Screen name="exercises/library" options={{ headerShown: false }} />
          <Stack.Screen name="exercise/edit" options={{ presentation: 'modal', title: 'Lag øvelse' }} />
          <Stack.Screen name="explore/program/[id]" options={{ title: '' }} />
          <Stack.Screen name="explore/routine/[id]" options={{ title: 'Rutine' }} />
          <Stack.Screen name="terms" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="legal/[doc]" options={{ title: '' }} />
          <Stack.Screen name="report" options={{ presentation: 'modal', title: 'Rapporter' }} />
          <Stack.Screen name="me/blocked" options={{ title: 'Blokkerte brukere' }} />
          <Stack.Screen name="moderation/index" options={{ title: 'Moderering' }} />
          <Stack.Screen name="calendar/index" options={{ title: 'Måned' }} />
          <Stack.Screen name="calendar/day" options={{ title: '' }} />
          <Stack.Screen name="settings/index" options={{ title: 'Innstillinger' }} />
          <Stack.Screen name="settings/privacy" options={{ title: 'Kontopersonvern' }} />
          <Stack.Screen name="settings/units" options={{ title: 'Enheter' }} />
          <Stack.Screen name="settings/theme" options={{ title: 'Tema' }} />
          <Stack.Screen name="settings/training" options={{ title: 'Treningsinnstillinger' }} />
          <Stack.Screen name="settings/help" options={{ title: 'Få hjelp' }} />
          <Stack.Screen name="settings/about" options={{ title: 'Om Liftyard' }} />
          <Stack.Screen name="settings/feedback" options={{ title: '' }} />
          <Stack.Screen name="settings/faq" options={{ title: 'Ofte stilte spørsmål' }} />
          <Stack.Screen name="settings/reminders" options={{ title: 'Treningspåminnelser' }} />
          <Stack.Screen name="moderation/feedback" options={{ title: 'Tilbakemeldinger' }} />
          <Stack.Screen name="me/index" options={{ title: '' }} />
          <Stack.Screen name="me/edit" options={{ presentation: 'modal', title: 'Rediger profil' }} />
          <Stack.Screen name="me/history" options={{ title: 'Treningshistorie' }} />
          <Stack.Screen name="me/stats" options={{ title: 'Statistikk' }} />
          <Stack.Screen name="measurements/index" options={{ title: 'Alle målinger' }} />
          <Stack.Screen name="measurements/[kind]" options={{ title: '' }} />
          <Stack.Screen name="measurements/add" options={{ presentation: 'modal', title: 'Ny måling' }} />
          <Stack.Screen name="measurements/goal" options={{ presentation: 'modal', title: 'Vektmål' }} />
        </Stack>
        <ToastHost />
      </ThemeProvider>
    </SQLiteProvider>
  );
}
