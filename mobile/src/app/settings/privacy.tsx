import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, StyleSheet, Switch } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ChoiceRow, SettingsRow, SettingsSection } from '@/features/settings/settings-row';
import { useLocalQuery } from '@/hooks/use-local-query';
import { refreshProfile, useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { syncPendingWorkouts } from '@/services/sync';
import { saveProfileFields } from '@/storage/profile-store';
import { getDefaultVisibility, setDefaultVisibility } from '@/storage/workout-store';
import { MaxContentWidth, Spacing } from '@/theme';
import type { ProfileFields } from '@/types/profile';
import { VISIBILITY_DESCRIPTIONS, VISIBILITY_LABELS, type WorkoutVisibility } from '@/types/workout';

const ORDER: WorkoutVisibility[] = ['PUBLIC', 'FOLLOWERS', 'PRIVATE'];

/** Kontopersonvern: privat profil, hvem som ser nye økter, blokkerte brukere. */
export default function PrivacySettings() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const profile = useProfile();
  const isPrivate = profile.visibility === 'PRIVATE';
  const { state, reload } = useLocalQuery(getDefaultVisibility);

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

  const changeDefault = async (v: WorkoutVisibility) => {
    await setDefaultVisibility(db, v);
    reload();
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <SettingsSection first>
        <SettingsRow
          icon="lock"
          title="Privat profil"
          subtitle="Andre ser bare navn, bilde og bio. Nye følgere må godkjennes."
          right={<Switch value={isPrivate} onValueChange={setPrivate} accessibilityLabel="Privat profil" />}
        />
        {profile.username && (
          <SettingsRow
            icon="eye"
            title="Se profilen slik andre ser den"
            onPress={() => router.push({ pathname: '/user/[username]', params: { username: profile.username! } })}
            chevron
          />
        )}
        <SettingsRow icon="hand.raised" title="Blokkerte brukere" onPress={() => router.push('/me/blocked')} chevron />
      </SettingsSection>

      <SettingsSection title="Nye økter" subtitle="Hvem ser øktene dine som standard">
        {state.status === 'ready' &&
          ORDER.map((v) => (
            <ChoiceRow
              key={v}
              label={VISIBILITY_LABELS[v]}
              description={VISIBILITY_DESCRIPTIONS[v]}
              selected={state.data === v}
              onPress={() => changeDefault(v)}
            />
          ))}
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          Du kan alltid velge noe annet for hver økt når du fullfører den. Fødselsdato, kjønn, vekt og kroppsmål vises aldri for andre.
        </ThemedText>
      </SettingsSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  note: { marginTop: Spacing.three },
});
