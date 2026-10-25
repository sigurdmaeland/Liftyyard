import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { DynamicColorIOS, Platform, useColorScheme } from 'react-native';

import { refreshServerProfile } from '@/features/auth/account';
import { refreshProfile, useProfileState } from '@/hooks/use-profile';
import { useAuth } from '@/services/auth-session';
import { Colors } from '@/theme';
import { getSettings } from '@/storage/settings-store';

/**
 * Fanelinjen nederst. Struktur, rekkefølge og navn følger Lyfta: Hjem, Utforsk, Trening, Bibliotek og Du.
 * På iOS 26 og nyere tegnes den native, flytende og gjennomskinnelige fanelinjen («Liquid Glass»)
 * med svarte ikoner og tekst i lys modus. Ikonene er Apples SF Symbols og Googles Material Symbols.
 */
export default function TabLayout() {
  const scheme = useColorScheme();
  const auth = useAuth();
  const { profile, loaded } = useProfileState();
  const db = useSQLiteContext();
  const signedIn = auth.status === 'signedIn';

  // Henter rolle og vilkårsstatus fra serveren ved oppstart (stille hvis det ikke er nett).
  useEffect(() => {
    if (signedIn) refreshServerProfile(db).then(() => refreshProfile(db)).catch(() => {});
    // Vektenhet (kg/lb) og andre innstillinger leses inn ved oppstart.
    getSettings(db).catch(() => {});
  }, [db, signedIn]);
  const ink =
    Platform.OS === 'ios'
      ? DynamicColorIOS({ light: Colors.light.text, dark: Colors.dark.text })
      : Colors[scheme === 'dark' ? 'dark' : 'light'].text;

  // Appen krever innlogging. Mens økten leses står oppstartsbildet over.
  if (auth.status === 'loading') return null;
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  // Ny profil: velkomstflyten (navn, brukernavn, om deg) må fullføres først.
  if (!loaded) return null;
  // Vilkår og aldersbekreftelse kommer før vi ber om personopplysninger i velkomstflyten.
  if (profile.mustAcceptTerms) return <Redirect href="/terms" />;
  if (!profile.username) return <Redirect href="/onboarding" />;

  return (
    <NativeTabs tintColor={ink} iconColor={{ default: ink, selected: ink }} labelStyle={{ color: ink }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Hjem</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Utforsk</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="start">
        <NativeTabs.Trigger.Label>Trening</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }} md="add_circle" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Label>Bibliotek</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'books.vertical', selected: 'books.vertical.fill' }} md="menu_book" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Du</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
