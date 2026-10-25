import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { openReport } from '@/features/safety/actions';
import { PartnersLine } from '@/features/social/feed-card';
import { UserAvatar } from '@/features/social/user-avatar';
import { AuthorHeader, PrivateNote, SectionDivider, WorkoutDetailScaffold } from '@/features/workout-view/detail';
import { ExerciseSets } from '@/features/workout-view/exercise-sets';
import { WorkoutOverview } from '@/features/workout-view/overview';
import { ActionBar, SocialSummary, openComments, shareWorkout } from '@/features/workout-view/social-bar';
import { useWorkoutRecords } from '@/features/workout-view/use-records';
import { useCatalog } from '@/hooks/use-catalog';
import { useTheme } from '@/hooks/use-theme';
import { formatVolume } from '@/lib/format';
import { bestMedals } from '@/lib/records';
import { muscleLoad } from '@/lib/muscles';
import { formatRelativeDateTime, formatShortDuration } from '@/lib/stats';
import { ApiError } from '@/services/api';
import { type Comment, type WorkoutView, fetchComments, fetchWorkoutView, leaveWorkoutPartner } from '@/services/feed';
import { Spacing } from '@/theme';

type State = { status: 'loading' } | { status: 'ready'; view: WorkoutView; comments: Comment[] } | { status: 'error'; message: string };

/** En økt som innlegg: bilder, oversikt, liker og kommentarer, private notater (eier) og alle sett. */
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const catalog = useCatalog();
  const [state, setState] = useState<State>({ status: 'loading' });

  // Hentes på nytt når man kommer tilbake fra kommentarene, så tallene stemmer.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([fetchWorkoutView(id), fetchComments(id)])
        .then(([view, comments]) => active && setState({ status: 'ready', view, comments }))
        .catch(
          (e: unknown) =>
            active &&
            setState((s) =>
              s.status === 'ready'
                ? s
                : {
                    status: 'error',
                    message:
                      e instanceof ApiError && e.status === 404 ? 'Økten finnes ikke, eller du har ikke tilgang til den.' : 'Kunne ikke hente økten. Har du nett?',
                  },
            ),
        );
      return () => {
        active = false;
      };
    }, [id]),
  );

  const serverRecords = state.status === 'ready' ? state.view.records : undefined;
  // Rekordene regnes ut på serveren; for egne økter uten svar derfra brukes historikken på telefonen.
  const isOwn = state.status === 'ready' && state.view.summary.author.isSelf;
  const local = useWorkoutRecords(id, isOwn && !serverRecords);
  const records = serverRecords
    ? (() => {
        const bySet = new Map(Object.entries(serverRecords));
        const lists = [...bySet.values()];
        return { bySet, summary: { count: lists.reduce((n, l) => n + l.length, 0), medals: bestMedals(lists) } };
      })()
    : local;

  if (state.status !== 'ready') {
    return (
      <WorkoutDetailScaffold photos={[]}>
        <View style={styles.center}>
          {state.status === 'loading' ? <ActivityIndicator /> : <ThemedText themeColor="textSecondary">{state.message}</ThemedText>}
        </View>
      </WorkoutDetailScaffold>
    );
  }

  const { summary, workout } = state.view;
  const seconds = (new Date(summary.endedAt).getTime() - new Date(summary.startedAt).getTime()) / 1000;
  const load = muscleLoad(workout.exercises, [...catalog.values()]);
  const authorName = summary.author.isSelf ? undefined : summary.author.displayName;

  const isPartner = summary.partners?.some((p) => p.isSelf) ?? false;
  const menu = () =>
    Alert.alert(summary.name, undefined, [
      { text: 'Del', onPress: () => shareWorkout(summary, authorName) },
      ...(isPartner
        ? [
            {
              text: 'Fjern meg som treningspartner',
              onPress: () =>
                leaveWorkoutPartner(summary.id)
                  .then(() =>
                    setState((s) =>
                      s.status === 'ready'
                        ? { ...s, view: { ...s.view, summary: { ...s.view.summary, partners: s.view.summary.partners?.filter((p) => !p.isSelf) } } }
                        : s,
                    ),
                  )
                  .catch(() => Alert.alert('Det gikk ikke', 'Prøv igjen når du har nett.')),
            },
          ]
        : []),
      ...(!summary.author.isSelf ? [{ text: 'Rapporter økten', onPress: () => openReport('WORKOUT', summary.id, summary.author.username) }] : []),
      { text: 'Avbryt', style: 'cancel' as const },
    ]);

  const latest = state.comments.slice(-2);

  return (
    <WorkoutDetailScaffold photos={summary.photoUrls} onMenu={menu}>
      <AuthorHeader
        avatarUrl={summary.author.avatarUrl}
        name={summary.author.displayName}
        username={summary.author.username}
        startedAt={summary.startedAt}
        visibility={summary.visibility}
      />
      {(summary.partners?.length ?? 0) > 0 && <PartnersLine partners={summary.partners!} />}
      <View style={styles.titleBlock}>
        <ThemedText accessibilityRole="header" style={styles.title}>
          {summary.name}
        </ThemedText>
        {summary.description && <ThemedText themeColor="textSecondary">{summary.description}</ThemedText>}
      </View>

      <WorkoutOverview
        load={load}
        stats={[
          { label: 'Varighet', value: formatShortDuration(seconds) },
          { label: 'Volum', value: formatVolume(summary.volumeKg) },
          { label: 'Sett', value: String(summary.completedSetCount) },
        ]}
        records={records.summary}
      />

      <View style={styles.social}>
        <SocialSummary item={summary} />
        <ActionBar
          item={summary}
          author={authorName}
          onChange={(likedByMe, likeCount) =>
            setState((s) => (s.status === 'ready' ? { ...s, view: { ...s.view, summary: { ...s.view.summary, likedByMe, likeCount } } } : s))
          }
        />
      </View>

      {latest.length > 0 && (
        <Pressable onPress={() => openComments(id)} accessibilityRole="button" accessibilityHint="Åpner alle kommentarer" style={styles.comments}>
          {latest.map((c) => (
            <View key={c.id} style={styles.comment}>
              <UserAvatar uri={c.author.avatarUrl} size={32} />
              <View style={styles.flex}>
                <ThemedText type="small" numberOfLines={2}>
                  <ThemedText type="smallBold">{c.author.displayName} </ThemedText>
                  {c.body}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatRelativeDateTime(c.createdAt)}
                </ThemedText>
              </View>
            </View>
          ))}
          {state.comments.length > latest.length && (
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              Se alle {state.comments.length} kommentarene
            </ThemedText>
          )}
        </Pressable>
      )}

      {workout.notes && (
        <>
          <SectionDivider />
          <PrivateNote text={workout.notes} />
        </>
      )}

      <SectionDivider />
      <ThemedText accessibilityRole="header" style={styles.section}>
        Øvelser
      </ThemedText>
      {workout.exercises.map((e) => (
        <ExerciseSets key={e.id} exercise={e} records={records.bySet} />
      ))}
      {!isOwn && (
        <Pressable onPress={() => router.push({ pathname: '/user/[username]', params: { username: summary.author.username } })} accessibilityRole="link">
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Flere økter fra {summary.author.displayName} →
          </ThemedText>
        </Pressable>
      )}
    </WorkoutDetailScaffold>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center', alignItems: 'center', paddingVertical: Spacing.five },
  titleBlock: { gap: Spacing.one, marginTop: Spacing.two },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 800 },
  social: { gap: Spacing.one, marginTop: Spacing.two },
  comments: { gap: Spacing.three },
  comment: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  flex: { flex: 1, gap: 2 },
  section: { fontSize: 24, lineHeight: 30, fontWeight: 800 },
});
