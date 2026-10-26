import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { showToast } from '@/components/toast';
import { deleteAccount, logout } from '@/features/auth/account';
import { APPEARANCE_OPTIONS, useAppearancePref } from '@/features/settings/appearance';
import { exportWorkoutsCsv } from '@/features/settings/export-data';
import { useReminders } from '@/features/settings/reminders';
import { SettingsRow, SettingsSection } from '@/features/settings/settings-row';
import { APP_VERSION } from '@/features/settings/support';
import { useRestTimer } from '@/features/workout/rest-timer';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/format';
import { summarize } from '@/lib/reminders';
import { unitLabel } from '@/lib/units';
import { syncPendingWorkouts } from '@/services/sync';
import { countUnsynced } from '@/storage/account-store';
import { getSettings } from '@/storage/settings-store';
import { MaxContentWidth, Spacing } from '@/theme';

/**
 * Innstillinger (oppbygd som Lyfta): Konto, Preferanser og Mer, med detaljsider for hvert valg.
 * Bare funksjoner som virker, er med. Logg ut og Slett konto ligger nederst.
 */
export default function SettingsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const profile = useProfile();
  const appearance = useAppearancePref();
  const { defaultSeconds } = useRestTimer();
  const reminders = useReminders();
  const { state: settingsState } = useLocalQuery(getSettings);
  const { state: unsyncedState, reload: reloadUnsynced } = useLocalQuery(countUnsynced);
  const settings = settingsState.status === 'ready' ? settingsState.data : null;
  const unsynced = unsyncedState.status === 'ready' ? unsyncedState.data : null;
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const r = await syncPendingWorkouts(db);
      showToast(
        r.failed > 0
          ? { title: `${r.failed} endring(er) ble avvist av serveren`, icon: 'exclamationmark.triangle.fill' }
          : r.pending > 0
            ? { title: 'Fikk ikke sendt alt', text: 'Prøver igjen senere.', icon: 'icloud.slash' }
            : { title: 'Alt er synkronisert', icon: 'checkmark.icloud' },
      );
    } catch (e) {
      showToast({ title: 'Synkroniseringen feilet', text: e instanceof Error ? e.message : undefined, icon: 'icloud.slash' });
    } finally {
      setSyncing(false);
      reloadUnsynced();
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      await exportWorkoutsCsv(db);
    } catch (e) {
      Alert.alert('Kunne ikke eksportere', e instanceof Error ? e.message : 'Ukjent feil');
    } finally {
      setExporting(false);
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
    const left = await countUnsynced(db);
    setSyncing(false);
    Alert.alert(
      'Logge ut?',
      left > 0
        ? `${left} endring(er) er ikke synkronisert og blir borte fra denne telefonen hvis du logger ut nå. Koble til nettet og prøv igjen for å beholde dem.`
        : 'Dataene dine er lagret på kontoen og hentes igjen når du logger inn.',
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: left > 0 ? 'Logg ut likevel' : 'Logg ut', style: 'destructive', onPress: () => logout(db).then(toLogin) },
      ],
    );
  };

  const confirmDelete = () =>
    Alert.alert(
      'Slette kontoen?',
      'Kontoen og alle øktene, programmene, rutinene, bildene og målingene dine slettes permanent. Dette kan ikke angres.',
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

  const isModerator = profile.role === 'MODERATOR' || profile.role === 'ADMIN';
  const weekly = settings?.weeklyWorkoutGoal;
  const trainingSubtitle = [
    weekly ? `Ukesmål ${weekly} ${weekly === 1 ? 'økt' : 'økter'}` : 'Uten ukesmål',
    defaultSeconds > 0 ? `hvile ${formatDuration(defaultSeconds)}` : 'hviletimer av',
  ].join(' · ');

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <SettingsSection first title="Konto" subtitle={profile.username ? `@${profile.username}` : undefined}>
        <SettingsRow icon="person" title="Profil" subtitle="Navn, bilde, bio og lenker" onPress={() => router.push('/me/edit')} />
        <SettingsRow
          icon="lock.shield"
          title="Kontopersonvern"
          subtitle={profile.visibility === 'PRIVATE' ? 'Privat profil' : 'Offentlig profil'}
          onPress={() => router.push('/settings/privacy')}
        />
        <SettingsRow
          icon="arrow.triangle.2.circlepath"
          title="Synkroniser treningsdata"
          subtitle={unsynced === null ? null : unsynced === 0 ? 'Alt er lagret på kontoen' : `${unsynced} endring(er) venter`}
          onPress={syncNow}
          busy={syncing}
        />
        <SettingsRow
          icon="square.and.arrow.up"
          title="Eksporter data"
          subtitle="Alle sett som regneark (CSV)"
          onPress={exportData}
          busy={exporting}
        />
      </SettingsSection>

      <SettingsSection title="Preferanser">
        <SettingsRow icon="scalemass" title="Enheter" subtitle={`${unitLabel(settings?.weightUnit)} / cm`} onPress={() => router.push('/settings/units')} />
        <SettingsRow
          icon="paintpalette"
          title="Tema"
          subtitle={APPEARANCE_OPTIONS.find((o) => o.value === appearance)?.label}
          onPress={() => router.push('/settings/theme')}
        />
        <SettingsRow
          icon="bell"
          title="Treningspåminnelser"
          subtitle={summarize(reminders)}
          onPress={() => router.push('/settings/reminders')}
        />
        <SettingsRow icon="dumbbell" title="Treningsinnstillinger" subtitle={trainingSubtitle} onPress={() => router.push('/settings/training')} />
      </SettingsSection>

      <SettingsSection title="Mer">
        <SettingsRow icon="questionmark.circle" title="Få hjelp" onPress={() => router.push('/settings/help')} />
        <SettingsRow icon="info.circle" title="Om Liftyard" subtitle={`Versjon ${APP_VERSION}`} onPress={() => router.push('/settings/about')} />
        {isModerator && <SettingsRow icon="checkmark.shield" title="Moderering" subtitle="Rapporter" onPress={() => router.push('/moderation')} />}
        {isModerator && <SettingsRow icon="tray" title="Tilbakemeldinger" subtitle="Feil, forslag og support" onPress={() => router.push('/moderation/feedback')} />}
      </SettingsSection>

      <SettingsSection>
        <SettingsRow title="Slett konto" destructive onPress={confirmDelete} />
        <SettingsRow title="Logg ut" onPress={confirmLogout} busy={syncing} />
      </SettingsSection>

      <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
        Liftyard {APP_VERSION}
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  version: { marginTop: Spacing.three },
});
