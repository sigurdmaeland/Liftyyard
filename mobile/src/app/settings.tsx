import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { BackendStatusCard } from '@/features/home/backend-status-card';
import { refreshProfile, useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { saveProfileFields } from '@/storage/profile-store';
import { getDefaultVisibility, setDefaultVisibility } from '@/storage/workout-store';
import { VisibilityPicker } from '@/features/workout/visibility-picker';
import { useLocalQuery } from '@/hooks/use-local-query';
import type { WorkoutVisibility } from '@/types/workout';
import type { ProfileFields } from '@/types/profile';
import { deleteAccount, logout } from '@/features/auth/account';
import { syncPendingWorkouts } from '@/services/sync';
import { countUnsynced } from '@/storage/account-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';
import { type WeightUnit } from '@/lib/units';
import { getSettings, setWeeklyGoal, setWeightUnit } from '@/storage/settings-store';
import { APPEARANCE_OPTIONS, setAppearance, useAppearancePref } from '@/features/settings/appearance';

/** Innstillinger: personvern, trygghet, enheter, synk, vilkår, konto (logg ut, slett konto) og utviklerstatus. */
export default function SettingsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const profile = useProfile();
  const isPrivate = profile.visibility === 'PRIVATE';
  const { state: defaultState, reload: reloadDefault } = useLocalQuery(getDefaultVisibility);
  const { state: settingsState, reload: reloadSettings } = useLocalQuery(getSettings);
  const settings = settingsState.status === 'ready' ? settingsState.data : null;
  const changeUnit = async (u: WeightUnit) => {
    await setWeightUnit(db, u);
    reloadSettings();
    syncPendingWorkouts(db).catch(() => {});
  };
  const changeWeekly = async (n: number | null) => {
    await setWeeklyGoal(db, n);
    reloadSettings();
    syncPendingWorkouts(db).catch(() => {});
  };
  const changeDefault = async (v: WorkoutVisibility) => {
    await setDefaultVisibility(db, v);
    reloadDefault();
  };

  /** Privat profil: andre ser bare navn, bilde og bio. Lagres lokalt og synkes. */
  const setPrivate = async (value: boolean) => {
    const fields: ProfileFields = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      bio: profile.bio,
      birthDate: profile.birthDate,
      gender: profile.gender,
      instagram: profile.instagram,
      tiktok: profile.tiktok,
      youtube: profile.youtube,
      website: profile.website,
      visibility: value ? 'PRIVATE' : 'PUBLIC',
    };
    await saveProfileFields(db, fields);
    await refreshProfile(db);
    syncPendingWorkouts(db).catch(() => {});
  };

  const syncNow = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const r = await syncPendingWorkouts(db);
      setResult(
        r.failed > 0
          ? `${r.failed} økt(er) ble avvist av serveren.`
          : r.pending > 0
            ? 'Fikk ikke sendt alt – prøver igjen senere.'
            : 'Alt er synkronisert.',
      );
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Synkroniseringen feilet.');
    } finally {
      setSyncing(false);
    }
  };

  /** Etter utlogging eller sletting: lukk alle skjermer og vis innloggingen. */
  const toLogin = () => {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/login');
  };

  const confirmLogout = async () => {
    setSyncing(true);
    await syncPendingWorkouts(db).catch(() => {});
    const unsynced = await countUnsynced(db);
    setSyncing(false);
    Alert.alert(
      'Logge ut?',
      unsynced > 0
        ? `${unsynced} endring(er) er ikke synkronisert og blir borte fra denne telefonen hvis du logger ut nå. Koble til nettet og prøv igjen for å beholde dem.`
        : 'Dataene dine er lagret på kontoen og hentes igjen når du logger inn.',
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: unsynced > 0 ? 'Logg ut likevel' : 'Logg ut', style: 'destructive', onPress: () => logout(db).then(toLogin) },
      ],
    );
  };

  const confirmDelete = () =>
    Alert.alert(
      'Slette kontoen?',
      'Kontoen og alle øktene, programmene, rutinene og målingene dine slettes permanent. Dette kan ikke angres.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Slett konto',
          style: 'destructive',
          onPress: () =>
            deleteAccount(db)
              .then(toLogin)
              .catch((e: unknown) => Alert.alert('Kunne ikke slette kontoen', e instanceof Error ? e.message : 'Ukjent feil')),
        },
      ],
    );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.backgroundGrouped }}
      contentContainerStyle={styles.content}>
      <AppearancePicker />
      <Group title="Personvern">
        <View style={styles.row}>
          <View style={styles.flex}>
            <ThemedText>Privat profil</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Andre ser bare navn, bilde og bio.
            </ThemedText>
          </View>
          <Switch value={isPrivate} onValueChange={setPrivate} accessibilityLabel="Privat profil" />
        </View>
        {profile.username && (
          <Pressable
            onPress={() => router.push({ pathname: '/user/[username]', params: { username: profile.username! } })}
            accessibilityRole="button"
            style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
            <ThemedText style={[styles.flex, { color: theme.accent }]}>Se profilen slik andre ser den</ThemedText>
          </Pressable>
        )}
      </Group>
      <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
        Fødselsdato, kjønn, vekt og kroppsmål vises aldri for andre.
      </ThemedText>

      <Group title="Trygghet">
        <LinkRow label="Blokkerte brukere" onPress={() => router.push('/me/blocked')} />
        <LinkRow
          label="Retningslinjer for community"
          onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'retningslinjer' } })}
          divider
        />
        {(profile.role === 'MODERATOR' || profile.role === 'ADMIN') && (
          <LinkRow label="Moderering" onPress={() => router.push('/moderation')} divider />
        )}
      </Group>

      <View style={styles.group}>
        <ThemedText accessibilityRole="header" type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
          Standard for nye økter
        </ThemedText>
        {defaultState.status === 'ready' && <VisibilityPicker value={defaultState.data} onChange={changeDefault} />}
      </View>

      <Group title="Trening">
        <View style={styles.row}>
          <ThemedText style={styles.flex}>Vektenhet</ThemedText>
          <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel="Vektenhet">
            {(['KG', 'LB'] as const).map((u) => {
              const on = (settings?.weightUnit ?? 'KG') === u;
              return (
                <Pressable
                  key={u}
                  onPress={() => changeUnit(u)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={u === 'KG' ? 'Kilo' : 'Pund'}
                  style={[styles.segmentItem, { backgroundColor: on ? theme.text : theme.backgroundElement }]}>
                  <ThemedText type="smallBold" style={{ color: on ? theme.background : theme.text }}>
                    {u === 'KG' ? 'kg' : 'lb'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
          <View style={styles.flex}>
            <ThemedText>Ukesmål</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Økter per uke
            </ThemedText>
          </View>
          <Stepper value={settings?.weeklyWorkoutGoal ?? null} onChange={changeWeekly} />
        </View>
      </Group>
      <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
        Vektenheten gjelder sett, rutiner, volum, rekorder og kroppsvekt. Kroppsmål vises i cm.
      </ThemedText>

      <Group title="Data">
        <Pressable onPress={syncNow} disabled={syncing} accessibilityRole="button" style={styles.row}>
          <ThemedText style={[styles.flex, { color: theme.accent }]}>Synkroniser nå</ThemedText>
          {syncing && <ActivityIndicator />}
        </Pressable>
      </Group>
      {result && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
          {result}
        </ThemedText>
      )}

      <Group title="Om appen">
        <LinkRow label="Vilkår for bruk" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'vilkar' } })} />
        <LinkRow
          label="Personvernerklæring"
          onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'personvern' } })}
          divider
        />
      </Group>

      <Group title="Konto">
        <Pressable onPress={confirmLogout} disabled={syncing} accessibilityRole="button" style={styles.row}>
          <ThemedText style={[styles.flex, { color: theme.accent }]}>Logg ut</ThemedText>
        </Pressable>
        <Pressable
          onPress={confirmDelete}
          accessibilityRole="button"
          style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
          <ThemedText style={[styles.flex, { color: theme.danger }]}>Slett konto</ThemedText>
        </Pressable>
      </Group>

      <Group title="Utvikler">
        <View style={styles.dev}>
          <BackendStatusCard />
        </View>
      </Group>

      <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
        Versjon {Constants.expoConfig?.version ?? '–'}
      </ThemedText>
    </ScrollView>
  );
}

/** Tre store valg med ikon og tekst: Automatisk (følger telefonen), Lys og Mørk. */
function AppearancePicker() {
  const theme = useTheme();
  const pref = useAppearancePref();
  return (
    <View style={styles.group}>
      <ThemedText accessibilityRole="header" type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
        Utseende
      </ThemedText>
      <View style={[styles.appearance, { backgroundColor: theme.card }]} accessibilityRole="radiogroup" accessibilityLabel="Utseende">
        {APPEARANCE_OPTIONS.map((o) => {
          const on = pref === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => setAppearance(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={o.value === 'system' ? 'Automatisk, følger telefonen' : o.label}
              style={[
                styles.appearanceItem,
                { backgroundColor: on ? theme.backgroundSelected : 'transparent', borderColor: on ? theme.accent : 'transparent' },
              ]}>
              <Icon name={o.icon} size={24} color={on ? theme.accent : theme.text} fallback={o.fallback} />
              <ThemedText type="smallBold" style={{ color: on ? theme.accent : theme.text }}>
                {o.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {pref === 'system' && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.appearanceNote}>
          Følger lys eller mørk modus på telefonen.
        </ThemedText>
      )}
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <ThemedText accessibilityRole="header" type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
        {title}
      </ThemedText>
      <View style={[styles.card, { backgroundColor: theme.card }]}>{children}</View>
    </View>
  );
}

/** − verdi + (av = null). */
function Stepper({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const theme = useTheme();
  const dec = () => onChange(value === null || value <= 1 ? null : value - 1);
  const inc = () => onChange(Math.min(14, (value ?? 0) + 1));
  return (
    <View
      style={styles.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Ukesmål"
      accessibilityValue={{ text: value === null ? 'Av' : `${value} økter` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? inc() : dec())}>
      <Pressable
        onPress={dec}
        disabled={value === null}
        style={[styles.stepButton, { backgroundColor: theme.backgroundElement, opacity: value === null ? 0.4 : 1 }]}>
        <ThemedText style={styles.stepText}>−</ThemedText>
      </Pressable>
      <ThemedText style={styles.stepValue}>{value === null ? 'Av' : value}</ThemedText>
      <Pressable onPress={inc} disabled={value === 14} style={[styles.stepButton, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={styles.stepText}>+</ThemedText>
      </Pressable>
    </View>
  );
}

function LinkRow({ label, onPress, divider }: { label: string; onPress: () => void; divider?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
        { opacity: pressed ? 0.6 : 1 },
      ]}>
      <ThemedText style={styles.flex}>{label}</ThemedText>
      <Icon name="chevron.right" size={14} color={theme.textSecondary} fallback="›" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  group: { gap: Spacing.two },
  groupTitle: { textTransform: 'uppercase', marginLeft: Spacing.three },
  card: { borderRadius: Radius.large, paddingHorizontal: Spacing.three, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 50, gap: Spacing.two, paddingVertical: Spacing.one },
  flex: { flex: 1 },
  footnote: { marginTop: -Spacing.three, marginLeft: Spacing.three },
  dev: { paddingVertical: Spacing.three },
  version: { textAlign: 'center' },
  segment: { flexDirection: 'row', gap: 4 },
  segmentItem: {
    minWidth: 52,
    minHeight: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  appearance: { flexDirection: 'row', gap: Spacing.one, borderRadius: Radius.large, padding: Spacing.one },
  appearanceItem: { flex: 1, minHeight: 72, borderRadius: Radius.medium, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  appearanceNote: { marginLeft: Spacing.three },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22, lineHeight: 26, fontWeight: 700 },
  stepValue: { minWidth: 32, textAlign: 'center', fontWeight: 700, fontVariant: ['tabular-nums'] },
});
