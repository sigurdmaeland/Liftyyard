import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { Stack, router } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CloseButton, SaveButton } from '@/features/profile/header-save';
import { OutlinedField } from '@/features/profile/outlined-field';
import { refreshProfile, useProfile } from '@/hooks/use-profile';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { pickJpeg } from '@/lib/image';
import { formatNumber, parseDecimal } from '@/lib/format';
import { ageFrom, latest } from '@/lib/profile-stats';
import { ApiError } from '@/services/api';
import { saveUsername } from '@/services/profile';
import { syncPendingWorkouts } from '@/services/sync';
import { addMeasurement, listMeasurements } from '@/storage/measurement-store';
import { saveProfileFields, setLocalUsername, setProfilePhoto } from '@/storage/profile-store';
import { Spacing } from '@/theme';
import { fromMeasurementDisplay, measurementLimits, toMeasurementDisplay } from '@/types/measurement';
import { unitLabel } from '@/lib/units';
import {
  GENDER_LABELS,
  type Gender,
  type Profile,
  type ProfileFields,
  latestAllowedBirthDate,
  normalizeHandle,
  normalizeUsername,
  usernameProblem,
} from '@/types/profile';

const loadWeight = async (db: SQLiteDatabase) => latest(await listMeasurements(db, 'WEIGHT'))?.value ?? null;

/** Rediger profil. Venter på siste vekt, slik at feltet kan fylles ut før skjemaet vises. */
export default function EditProfileScreen() {
  const profile = useProfile();
  const { state } = useLocalQuery(loadWeight);
  if (state.status !== 'ready') return <ThemedView style={styles.fill} />;
  return <Form profile={profile} currentWeight={state.data} />;
}

/** undefined = uendret, null = fjern bildet, string = nytt bilde valgt. */
type PhotoChange = string | null | undefined;

const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIsoDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const blank = (s: string) => s.trim() || null;

function Form({ profile, currentWeight }: { profile: Profile; currentWeight: number | null }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [firstName, setFirstName] = useState(profile.firstName ?? '');
  const [username, setUsername] = useState(profile.username ?? '');
  const [lastName, setLastName] = useState(profile.lastName ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [birthDate, setBirthDate] = useState<string | null>(profile.birthDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<Gender | null>(profile.gender);
  const [weight, setWeight] = useState(currentWeight !== null ? formatNumber(toMeasurementDisplay('WEIGHT', currentWeight), 1) : '');
  const [instagram, setInstagram] = useState(profile.instagram ?? '');
  const [tiktok, setTiktok] = useState(profile.tiktok ?? '');
  const [website, setWebsite] = useState(profile.website ?? '');
  const [youtube, setYoutube] = useState(profile.youtube ?? '');
  const [photo, setPhoto] = useState<PhotoChange>(undefined);
  const [saving, setSaving] = useState(false);

  const shownPhoto = photo === undefined ? profile.photoUri : photo;
  const weightValue = parseDecimal(weight);
  const limits = measurementLimits('WEIGHT');
  const weightValid = weight.trim() === '' || (weightValue !== null && weightValue >= limits.min && weightValue <= limits.max);
  const usernameError = usernameProblem(normalizeUsername(username));
  const valid = firstName.trim().length > 0 && weightValid && !usernameError;

  const pick = async () => {
    const uri = await pickJpeg({ square: true, maxSide: 1024 });
    if (uri) setPhoto(uri);
  };
  const choosePhoto = () => {
    if (!shownPhoto) {
      pick();
      return;
    }
    Alert.alert('Profilbilde', undefined, [
      { text: 'Velg nytt bilde', onPress: pick },
      { text: 'Fjern bilde', style: 'destructive', onPress: () => setPhoto(null) },
      { text: 'Avbryt', style: 'cancel' },
    ]);
  };

  const chooseGender = () =>
    Alert.alert('Kjønn', undefined, [
      ...(Object.keys(GENDER_LABELS) as Gender[]).map((g) => ({ text: GENDER_LABELS[g], onPress: () => setGender(g) })),
      { text: 'Ikke oppgitt', onPress: () => setGender(null) },
      { text: 'Avbryt', style: 'cancel' as const },
    ]);

  const maxBirth = latestAllowedBirthDate();
  const chooseBirthDate = () => {
    const value = birthDate ? fromIsoDate(birthDate) : new Date(maxBirth.getFullYear() - 12, 0, 1);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value, mode: 'date', maximumDate: maxBirth, onValueChange: (_e, d) => setBirthDate(toIsoDate(d)) });
    } else {
      if (!birthDate) setBirthDate(toIsoDate(value));
      setShowDatePicker((v) => !v);
    }
  };

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      // Brukernavnet må være ledig, så det lagres på serveren med en gang (krever nett).
      const wanted = normalizeUsername(username);
      if (wanted !== profile.username) {
        try {
          const saved = await saveUsername(wanted);
          await setLocalUsername(db, saved.username);
        } catch (e) {
          setSaving(false);
          const message =
            e instanceof ApiError && e.status === 409
              ? 'Brukernavnet er tatt. Velg et annet.'
              : e instanceof ApiError && e.isNetworkError
                ? 'Å endre brukernavn krever nett.'
                : e instanceof Error
                  ? e.message
                  : 'Ukjent feil';
          Alert.alert('Kunne ikke endre brukernavn', message);
          return;
        }
      }
      const fields: ProfileFields = {
        firstName: firstName.trim(),
        lastName: blank(lastName),
        bio: blank(bio),
        birthDate,
        gender,
        instagram: normalizeHandle(instagram),
        tiktok: normalizeHandle(tiktok),
        youtube: normalizeHandle(youtube),
        website: blank(website),
        visibility: profile.visibility,
      };
      await saveProfileFields(db, fields);
      if (photo !== undefined) await setProfilePhoto(db, photo);
      // Ny vekt registreres som en innveiing nå, slik at den også vises under Målinger.
      const weightKg = weightValue === null ? null : fromMeasurementDisplay('WEIGHT', weightValue);
      if (weightKg !== null && (currentWeight === null || Math.abs(weightKg - currentWeight) >= 0.05)) {
        await addMeasurement(db, 'WEIGHT', weightKg, new Date().toISOString());
      }
      await refreshProfile(db);
      syncPendingWorkouts(db).catch(() => {});
      router.back();
    } catch (e) {
      setSaving(false);
      Alert.alert('Kunne ikke lagre', e instanceof Error ? e.message : 'Ukjent feil');
    }
  };

  const birthLabel = birthDate
    ? `${fromIsoDate(birthDate).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })} (${ageFrom(birthDate)} år)`
    : null;

  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: 'Rediger profil',
          headerLeft: () => <CloseButton />,
          headerRight: () => <SaveButton onPress={save} disabled={!valid || saving} />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Pressable onPress={choosePhoto} accessibilityRole="button" accessibilityLabel="Endre profilbilde" style={styles.photoWrap}>
          <View style={[styles.photo, { backgroundColor: theme.backgroundSelected, borderColor: theme.backgroundSelected }]}>
            {shownPhoto ? (
              <Image source={{ uri: shownPhoto }} style={styles.photoImage} contentFit="cover" />
            ) : (
              <Icon name="person.fill" size={60} color={theme.textSecondary} fallback="●" />
            )}
          </View>
          <View style={[styles.cameraBadge, { backgroundColor: theme.text, borderColor: theme.background }]}>
            <Icon name="camera.fill" size={14} color={theme.background} fallback="📷" />
          </View>
        </Pressable>

        <View style={styles.row}>
          <OutlinedField label="Fornavn" value={firstName} onChangeText={setFirstName} maxLength={50} autoCapitalize="words" textContentType="givenName" />
          <OutlinedField label="Etternavn" value={lastName} onChangeText={setLastName} maxLength={50} autoCapitalize="words" textContentType="familyName" />
        </View>
        <OutlinedField
          label="Brukernavn"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={31}
          style={usernameError ? { borderColor: theme.danger } : undefined}
        />
        {usernameError && (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {usernameError}
          </ThemedText>
        )}
        <OutlinedField label="Bio" value={bio} onChangeText={setBio} maxLength={300} multiline />
        <OutlinedField label="Alder" floatLabel placeholder="Fødselsdato" onPress={chooseBirthDate} display={birthLabel} />
        {showDatePicker && Platform.OS === 'ios' && birthDate && (
          <View style={styles.datePicker}>
            <DateTimePicker
              value={fromIsoDate(birthDate)}
              mode="date"
              display="spinner"
              locale="nb-NO"
              maximumDate={maxBirth}
              onValueChange={(_e, d) => setBirthDate(toIsoDate(d))}
            />
          </View>
        )}
        <View style={styles.row}>
          <OutlinedField label="Kjønn" floatLabel placeholder="Velg" onPress={chooseGender} display={gender ? GENDER_LABELS[gender] : null} />
          <OutlinedField
            label="Vekt"
            floatLabel
            placeholder={unitLabel()}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            style={!weightValid ? { borderColor: theme.danger } : undefined}
          />
        </View>
        <View style={styles.row}>
          <OutlinedField label="@instagram" value={instagram} onChangeText={setInstagram} autoCapitalize="none" autoCorrect={false} maxLength={40} />
          <OutlinedField label="@tiktok" value={tiktok} onChangeText={setTiktok} autoCapitalize="none" autoCorrect={false} maxLength={40} />
        </View>
        <View style={styles.row}>
          <OutlinedField label="Website" value={website} onChangeText={setWebsite} autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={200} />
          <OutlinedField label="@youtube" value={youtube} onChangeText={setYoutube} autoCapitalize="none" autoCorrect={false} maxLength={100} />
        </View>
        {!weightValid && (
          <ThemedText type="small" style={{ color: theme.danger }}>
            Vekten må være mellom {limits.min} og {limits.max} {unitLabel()}.
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          Ny vekt lagres som en innveiing under Målinger. Fødselsdato, kjønn og vekt vises aldri for andre.
        </ThemedText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: 80 },
  photoWrap: { alignSelf: 'center', marginVertical: Spacing.three },
  photo: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { width: 120, height: 120 },
  cameraBadge: { position: 'absolute', right: 2, bottom: 2, width: 32, height: 32, borderRadius: 16, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: Spacing.three },
  datePicker: { alignItems: 'center' },
});
