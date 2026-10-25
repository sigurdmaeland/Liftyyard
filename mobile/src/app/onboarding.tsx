import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { OutlinedField } from '@/features/profile/outlined-field';
import { refreshProfile, useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { pickJpeg } from '@/lib/image';
import { formatNumber, parseDecimal } from '@/lib/format';
import { ageFrom } from '@/lib/profile-stats';
import { ApiError } from '@/services/api';
import { useAuth } from '@/services/auth-session';
import { checkUsername, saveUsername } from '@/services/profile';
import { syncPendingWorkouts } from '@/services/sync';
import { addMeasurement } from '@/storage/measurement-store';
import { saveProfileFields, setLocalUsername, setProfilePhoto } from '@/storage/profile-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';
import { fromMeasurementDisplay, measurementLimits } from '@/types/measurement';
import { unitLabel } from '@/lib/units';
import {
  GENDER_LABELS,
  type Gender,
  latestAllowedBirthDate,
  normalizeUsername,
  suggestUsername,
  usernameProblem,
} from '@/types/profile';

type Step = 'name' | 'username' | 'about';
const STEPS: Step[] = ['name', 'username', 'about'];

const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIsoDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

type Check = { state: 'idle' | 'checking' } | { state: 'ok' } | { state: 'error'; message: string };

/**
 * Velkomstflyt for nye profiler: navn og bilde → brukernavn → om deg (fødselsdato, kjønn, høyde, vekt).
 * Påkrevd: fornavn, brukernavn og fødselsdato (aldersgrense 13 år). Resten kan fylles ut senere.
 * Kjønn, fødselsdato, høyde og vekt vises aldri for andre.
 */
export default function OnboardingScreen() {
  const auth = useAuth();
  const profile = useProfile();
  const db = useSQLiteContext();
  const theme = useTheme();

  const [step, setStep] = useState<Step>('name');
  const [firstName, setFirstName] = useState(profile.firstName ?? '');
  const [lastName, setLastName] = useState(profile.lastName ?? '');
  const [photo, setPhoto] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const [birthDate, setBirthDate] = useState<string | null>(profile.birthDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<Gender | null>(profile.gender);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);

  const normalized = normalizeUsername(username);
  const localProblem = normalized ? usernameProblem(normalized) : null;

  // Sjekker om brukernavnet er ledig mens man skriver (litt forsinket for å spare kall).
  useEffect(() => {
    if (step !== 'username' || !normalized || localProblem) return;
    let active = true;
    const timer = setTimeout(() => {
      setCheck({ state: 'checking' });
      checkUsername(normalized)
        .then((r) => active && setCheck(r.available ? { state: 'ok' } : { state: 'error', message: r.reason ?? 'Ikke tilgjengelig' }))
        .catch(() => active && setCheck({ state: 'error', message: 'Fikk ikke sjekket brukernavnet. Har du nett?' }));
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [normalized, localProblem, step]);

  if (auth.status === 'signedOut') return <Redirect href="/login" />;

  const heightValue = parseDecimal(height);
  const weightValue = parseDecimal(weight);
  const hLimits = measurementLimits('HEIGHT');
  const wLimits = measurementLimits('WEIGHT');
  const heightValid = height.trim() === '' || (heightValue !== null && heightValue >= hLimits.min && heightValue <= hLimits.max);
  const weightValid = weight.trim() === '' || (weightValue !== null && weightValue >= wLimits.min && weightValue <= wLimits.max);
  const maxBirth = latestAllowedBirthDate();

  const canContinue =
    step === 'name'
      ? firstName.trim().length > 0
      : step === 'username'
        ? !localProblem && normalized.length > 0 && check.state === 'ok'
        : birthDate !== null && heightValid && weightValid;

  const pickPhoto = async () => {
    const uri = await pickJpeg({ square: true, maxSide: 1024 });
    if (uri) setPhoto(uri);
  };

  const chooseGender = () =>
    Alert.alert('Kjønn', 'Brukes bare i din egen statistikk og vises aldri for andre.', [
      ...(Object.keys(GENDER_LABELS) as Gender[]).map((g) => ({ text: GENDER_LABELS[g], onPress: () => setGender(g) })),
      { text: 'Vil ikke oppgi', onPress: () => setGender(null) },
      { text: 'Avbryt', style: 'cancel' as const },
    ]);

  const chooseBirthDate = () => {
    const value = birthDate ? fromIsoDate(birthDate) : new Date(maxBirth.getFullYear() - 12, 0, 1);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value, mode: 'date', maximumDate: maxBirth, onValueChange: (_e, d) => setBirthDate(toIsoDate(d)) });
    } else {
      if (!birthDate) setBirthDate(toIsoDate(value));
      setShowDatePicker((v) => !v);
    }
  };

  const goToUsername = () => {
    if (!username) setUsername(suggestUsername(firstName, lastName));
    setStep('username');
  };

  const finish = async () => {
    if (!canContinue || saving) return;
    setSaving(true);
    try {
      // Brukernavnet må være ledig på serveren; resten lagres lokalt og synkes.
      const saved = await saveUsername(normalized);
      await setLocalUsername(db, saved.username);
      await saveProfileFields(db, {
        bio: profile.bio,
        instagram: profile.instagram,
        tiktok: profile.tiktok,
        youtube: profile.youtube,
        website: profile.website,
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        birthDate,
        gender,
        visibility: profile.visibility ?? 'PUBLIC',
      });
      const now = new Date().toISOString();
      if (heightValue !== null && height.trim()) await addMeasurement(db, 'HEIGHT', heightValue, now);
      if (weightValue !== null && weight.trim()) await addMeasurement(db, 'WEIGHT', fromMeasurementDisplay('WEIGHT', weightValue), now);
      if (photo) await setProfilePhoto(db, photo);
      await refreshProfile(db);
      syncPendingWorkouts(db).catch(() => {});
      router.replace('/');
    } catch (e) {
      setSaving(false);
      if (e instanceof ApiError && e.status === 409) {
        setStep('username');
        setCheck({ state: 'error', message: 'Brukernavnet ble nettopp tatt. Velg et annet.' });
      } else {
        Alert.alert('Kunne ikke lagre', e instanceof Error ? e.message : 'Ukjent feil');
      }
    }
  };

  const next = () => {
    if (!canContinue) return;
    if (step === 'name') goToUsername();
    else if (step === 'username') setStep('about');
    else finish();
  };

  const index = STEPS.indexOf(step);
  const shownPhoto = photo ?? profile.photoUri;

  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.fill}>
        <View style={styles.top}>
          {index > 0 ? (
            <Pressable onPress={() => setStep(STEPS[index - 1])} hitSlop={12} accessibilityRole="button" accessibilityLabel="Tilbake">
              <Icon name="chevron.left" size={22} color={theme.text} fallback="‹" />
            </Pressable>
          ) : (
            <View style={styles.topSpacer} />
          )}
          <View style={styles.progress} accessibilityLabel={`Steg ${index + 1} av ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <View key={s} style={[styles.progressBar, { backgroundColor: i <= index ? theme.text : theme.backgroundSelected }]} />
            ))}
          </View>
          <View style={styles.topSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {step === 'name' && (
            <>
              <ThemedText accessibilityRole="header" style={styles.title}>Velkommen! Hvem er du?</ThemedText>
              <ThemedText themeColor="textSecondary">Navnet og bildet ditt vises på profilen din.</ThemedText>
              <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Velg profilbilde" style={styles.photoWrap}>
                <View style={[styles.photo, { backgroundColor: theme.backgroundSelected }]}>
                  {shownPhoto ? (
                    <Image source={{ uri: shownPhoto }} style={styles.photoImage} contentFit="cover" />
                  ) : (
                    <Icon name="person.fill" size={56} color={theme.textSecondary} fallback="●" />
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
            </>
          )}

          {step === 'username' && (
            <>
              <ThemedText accessibilityRole="header" style={styles.title}>Velg et brukernavn</ThemedText>
              <ThemedText themeColor="textSecondary">Andre finner deg med @brukernavnet ditt. Du kan endre det senere.</ThemedText>
              <OutlinedField
                label="Brukernavn"
                value={username}
                onChangeText={(v) => {
                  setUsername(v);
                  setCheck({ state: 'idle' });
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                maxLength={31}
                returnKeyType="next"
                onSubmitEditing={next}
              />
              <View style={styles.checkRow}>
                {localProblem ? (
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    {localProblem}
                  </ThemedText>
                ) : check.state === 'checking' ? (
                  <ActivityIndicator size="small" />
                ) : check.state === 'ok' ? (
                  <ThemedText type="small" style={{ color: theme.success }}>
                    @{normalized} er ledig
                  </ThemedText>
                ) : check.state === 'error' ? (
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    {check.message}
                  </ThemedText>
                ) : null}
              </View>
            </>
          )}

          {step === 'about' && (
            <>
              <ThemedText accessibilityRole="header" style={styles.title}>Litt om deg</ThemedText>
              <ThemedText themeColor="textSecondary">
                Brukes til statistikk og fremgang. Fødselsdato, kjønn, høyde og vekt vises aldri for andre.
              </ThemedText>
              <OutlinedField
                label="Fødselsdato"
                floatLabel
                placeholder="Velg dato"
                onPress={chooseBirthDate}
                display={
                  birthDate
                    ? `${fromIsoDate(birthDate).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })} (${ageFrom(birthDate)} år)`
                    : null
                }
              />
              {showDatePicker && Platform.OS === 'ios' && birthDate && (
                <DateTimePicker
                  value={fromIsoDate(birthDate)}
                  mode="date"
                  display="spinner"
                  locale="nb-NO"
                  maximumDate={maxBirth}
                  onValueChange={(_e, d) => setBirthDate(toIsoDate(d))}
                />
              )}
              <OutlinedField label="Kjønn" floatLabel placeholder="Valgfritt" onPress={chooseGender} display={gender ? GENDER_LABELS[gender] : null} />
              <View style={styles.row}>
                <OutlinedField
                  label="Høyde (cm)"
                  floatLabel
                  placeholder="Valgfritt"
                  value={height}
                  onChangeText={setHeight}
                  keyboardType="decimal-pad"
                  style={!heightValid ? { borderColor: theme.danger } : undefined}
                />
                <OutlinedField
                  label={`Vekt (${unitLabel()})`}
                  floatLabel
                  placeholder="Valgfritt"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  style={!weightValid ? { borderColor: theme.danger } : undefined}
                />
              </View>
              {(!heightValid || !weightValid) && (
                <ThemedText type="small" style={{ color: theme.danger }}>
                  {!heightValid ? `Høyden må være mellom ${hLimits.min} og ${hLimits.max} cm. ` : ''}
                  {!weightValid ? `Vekten må være mellom ${formatNumber(wLimits.min)} og ${formatNumber(wLimits.max)} ${unitLabel()}.` : ''}
                </ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                Du må være minst 13 år for å bruke appen.
              </ThemedText>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={next}
            disabled={!canContinue || saving}
            accessibilityRole="button"
            style={[styles.button, { backgroundColor: theme.text, opacity: !canContinue || saving ? 0.35 : 1 }]}>
            {saving ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText style={[styles.buttonLabel, { color: theme.background }]}>{step === 'about' ? 'Ferdig' : 'Fortsett'}</ThemedText>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  topSpacer: { width: 22 },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },
  content: { padding: Spacing.four, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 800, marginTop: Spacing.three },
  photoWrap: { alignSelf: 'center', marginVertical: Spacing.three },
  photo: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { width: 120, height: 120 },
  cameraBadge: { position: 'absolute', right: 2, bottom: 2, width: 32, height: 32, borderRadius: 16, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: Spacing.three },
  checkRow: { minHeight: 22 },
  footer: { padding: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  button: { minHeight: 54, borderRadius: Radius.large * 2, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { fontSize: 17, fontWeight: 700 },
});
