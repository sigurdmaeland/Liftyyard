import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { SyncBadge } from '@/features/history/sync-badge';
import { AuthorHeader, PrivateNote, SectionDivider, WorkoutDetailScaffold } from '@/features/workout-view/detail';
import { ExerciseSets } from '@/features/workout-view/exercise-sets';
import { WorkoutOverview } from '@/features/workout-view/overview';
import { ActionBar, SocialSummary, shareWorkout } from '@/features/workout-view/social-bar';
import { PartnersLine } from '@/features/social/feed-card';
import { useWorkoutRecords } from '@/features/workout-view/use-records';
import { PhotoStrip } from '@/features/workout/photo-strip';
import { VisibilityPicker } from '@/features/workout/visibility-picker';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { estimateCalories } from '@/lib/calories';
import { formatVolume } from '@/lib/format';
import { computeTotals } from '@/lib/metrics';
import { muscleLoad } from '@/lib/muscles';
import { formatShortDuration } from '@/lib/stats';
import { type FeedItem, fetchWorkoutView } from '@/services/feed';
import { syncPendingWorkouts } from '@/services/sync';
import { listExercises } from '@/storage/exercise-store';
import { listMeasurements } from '@/storage/measurement-store';
import { addWorkoutPhoto, listWorkoutPhotos, removeWorkoutPhoto, retryPhoto } from '@/storage/photo-store';
import { deleteFinishedWorkout, getWorkout, setWorkoutVisibility } from '@/storage/workout-store';
import { Spacing } from '@/theme';

/**
 * En av dine egne økter fra telefonen (også uten nett). Samme utseende som innlegg i feeden, pluss
 * redigering av bilder og synlighet. Vises også som oppsummering rett etter fullføring (?finished=1).
 */
export default function WorkoutDetailScreen() {
  const { id, finished } = useLocalSearchParams<{ id: string; finished?: string }>();
  const db = useSQLiteContext();
  const theme = useTheme();
  const profile = useProfile();
  const query = useCallback(
    async (d: SQLiteDatabase) => {
      const weights = await listMeasurements(d, 'WEIGHT');
      return {
        workout: await getWorkout(d, id),
        photos: await listWorkoutPhotos(d, id),
        catalog: await listExercises(d),
        // Siste innveiing før (eller samme dag som) økten, ellers den første som finnes.
        bodyWeight: weights.length > 0 ? weights[weights.length - 1].value : null,
      };
    },
    [id],
  );
  const { state, reload } = useLocalQuery(query);
  const records = useWorkoutRecords(id);
  const [social, setSocial] = useState<FeedItem | null>(null);
  const justFinished = finished === '1';
  const synced = state.status === 'ready' && state.data.workout?.syncStatus === 'synced';

  // Liker og kommentarer finnes bare på serveren; hentes når økten er synket og det er nett.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (synced) {
        fetchWorkoutView(id)
          .then((v) => active && setSocial(v.summary))
          .catch(() => {});
      }
      return () => {
        active = false;
      };
    }, [id, synced]),
  );

  const afterChange = () => {
    reload();
    syncPendingWorkouts(db)
      .then(reload)
      .catch(() => {});
  };

  const confirmDelete = () =>
    Alert.alert('Slette økten?', 'Økten slettes fra telefonen og serveren. Dette kan ikke angres.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Slett',
        style: 'destructive',
        onPress: async () => {
          await deleteFinishedWorkout(db, id);
          syncPendingWorkouts(db).catch(() => {});
          router.back();
        },
      },
    ]);

  if (state.status !== 'ready') return <WorkoutDetailScaffold photos={[]}>{null}</WorkoutDetailScaffold>;
  const { workout: w, catalog, photos, bodyWeight } = state.data;
  if (!w) {
    return (
      <WorkoutDetailScaffold photos={[]}>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Fant ikke økten.
        </ThemedText>
      </WorkoutDetailScaffold>
    );
  }

  const totals = computeTotals(w.exercises);
  const seconds = (new Date(w.endedAt ?? w.startedAt).getTime() - new Date(w.startedAt).getTime()) / 1000;
  const kcal = estimateCalories(bodyWeight, seconds);
  const menu = () =>
    Alert.alert(w.name, undefined, [
      { text: 'Del som bilde', onPress: () => router.push({ pathname: '/share/workout', params: { id: w.id } }) },
      { text: 'Del som tekst', onPress: () => shareWorkout({ name: w.name, volumeKg: totals.volumeKg }) },
      { text: 'Slett økten', style: 'destructive', onPress: confirmDelete },
      { text: 'Avbryt', style: 'cancel' },
    ]);

  return (
    <WorkoutDetailScaffold photos={photos.map((p) => p.uri)} onMenu={menu}>
      {justFinished && (
        <View style={[styles.banner, { backgroundColor: `${theme.successFill}22` }]} accessibilityLiveRegion="polite">
          <Icon name="checkmark.seal.fill" color={theme.success} fallback="✓" />
          <ThemedText type="smallBold" style={{ color: theme.success }}>
            Bra jobba! Økten er lagret.
          </ThemedText>
        </View>
      )}

      <AuthorHeader
        avatarUrl={profile.photoUri}
        name={profile.displayName ?? 'Du'}
        startedAt={w.startedAt}
        visibility={w.visibility}
        right={w.syncStatus !== 'synced' ? <SyncBadge status={w.syncStatus} /> : undefined}
      />
      <View style={styles.titleBlock}>
        <ThemedText accessibilityRole="header" style={styles.title}>
          {w.name}
        </ThemedText>
        {w.description && <ThemedText themeColor="textSecondary">{w.description}</ThemedText>}
      </View>

      <WorkoutOverview
        load={muscleLoad(w.exercises, catalog)}
        stats={[
          { label: 'Varighet', value: formatShortDuration(seconds) },
          { label: 'Volum', value: formatVolume(totals.volumeKg) },
          { label: 'Sett', value: String(totals.completedSetCount) },
          ...(w.perceivedEffort !== null ? [{ label: 'Anstrengelse', value: `${w.perceivedEffort}/10` }] : []),
          ...(kcal !== null ? [{ label: 'Kalorier (anslag)', value: `~${kcal} kcal` }] : []),
        ]}
        records={records.summary}
      />

      {social && (
        <View style={[styles.partners, { borderColor: theme.backgroundSelected }]}>
          {(social.partners?.length ?? 0) > 0 ? (
            <View style={styles.flex}>
              <PartnersLine partners={social.partners!} />
            </View>
          ) : (
            <ThemedText style={styles.flex}>Trente du med noen?</ThemedText>
          )}
          <Pressable
            onPress={() => router.push({ pathname: '/history/partners', params: { id: w.id } })}
            accessibilityRole="button"
            accessibilityLabel={(social.partners?.length ?? 0) > 0 ? 'Endre treningspartnere' : 'Legg til treningspartnere'}
            style={[styles.addPartner, { borderColor: theme.text }]}>
            <ThemedText type="smallBold">{(social.partners?.length ?? 0) > 0 ? 'Endre' : 'Legg til'}</ThemedText>
          </Pressable>
        </View>
      )}
      {social && (
        <View style={styles.social}>
          <SocialSummary item={social} />
          <ActionBar item={social} onChange={(likedByMe, likeCount) => setSocial({ ...social, likedByMe, likeCount })} />
        </View>
      )}
      {w.syncStatus === 'failed' && w.syncError && (
        <ThemedText type="small" themeColor="danger">
          Synk feilet: {w.syncError}
        </ThemedText>
      )}

      {w.notes && (
        <>
          <SectionDivider />
          <PrivateNote text={w.notes} />
        </>
      )}

      <SectionDivider />
      <ThemedText accessibilityRole="header" style={styles.section}>
        Bilder og synlighet
      </ThemedText>
      <PhotoStrip
        size={72}
        photos={photos}
        onRetry={async (photoId) => {
          await retryPhoto(db, photoId);
          afterChange();
        }}
        onAdd={async (uri) => {
          await addWorkoutPhoto(db, w.id, uri);
          afterChange();
        }}
        onRemove={async (photoId) => {
          await removeWorkoutPhoto(db, photoId);
          afterChange();
        }}
      />
      <VisibilityPicker
        value={w.visibility}
        onChange={async (v) => {
          await setWorkoutVisibility(db, w.id, v);
          afterChange();
        }}
      />

      <SectionDivider />
      <ThemedText accessibilityRole="header" style={styles.section}>
        Øvelser
      </ThemedText>
      {w.exercises.map((e) => (
        <ExerciseSets key={e.id} exercise={e} records={records.bySet} />
      ))}

      {justFinished && <Button label="Ferdig" onPress={() => router.dismissTo('/')} />}
    </WorkoutDetailScaffold>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center', paddingVertical: Spacing.five },
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: 12 },
  titleBlock: { gap: Spacing.one, marginTop: Spacing.two },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 800 },
  social: { gap: Spacing.one, marginTop: Spacing.two },
  partners: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
  addPartner: { minHeight: 40, paddingHorizontal: Spacing.four, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  section: { fontSize: 24, lineHeight: 30, fontWeight: 800 },
});
