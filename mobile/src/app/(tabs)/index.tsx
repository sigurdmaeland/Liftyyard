import { router, useFocusEffect } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { EmptyState } from '@/components/empty-state';
import { FeedSkeleton } from '@/components/skeleton';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StartWorkoutButton } from '@/features/home/start-workout-button';
import { WeeklySummary } from '@/features/home/weekly-summary';
import { FeedCard } from '@/features/social/feed-card';
import { localFeedItem } from '@/features/social/local-feed-item';
import { useProfile } from '@/hooks/use-profile';
import { listLocalPhotoUris } from '@/storage/photo-store';
import { Icon } from '@/components/icon';
import { type FeedItem, fetchFeed, fetchUnreadCount } from '@/services/feed';
import type { Workout } from '@/types/workout';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { recordSummaryPerWorkout, weekStreak, weeklySummary } from '@/lib/stats';
import { syncPendingWorkouts } from '@/services/sync';
import { countPendingSync, getActiveWorkout, listFinishedWorkoutsDetailed, retryFailed } from '@/storage/workout-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';
import { getSettings } from '@/storage/settings-store';

const loadHome = async (db: SQLiteDatabase) => ({
  active: await getActiveWorkout(db),
  workouts: await listFinishedWorkoutsDetailed(db),
  sync: await countPendingSync(db),
  photos: await listLocalPhotoUris(db),
  settings: await getSettings(db),
});

type Remote = { status: 'loading' } | { status: 'ready'; items: FeedItem[]; done: boolean } | { status: 'offline' };
type Row = { kind: 'remote'; item: FeedItem } | { kind: 'local'; workout: Workout };

/**
 * Hjem: ukessammendrag og feed med dine økter og øktene til dem du følger (fra serveren).
 * Egne økter som ikke er synket ennå vises også. Uten nett vises bare dine egne økter.
 */
export default function HomeScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { state, reload } = useLocalQuery(loadHome);
  const [syncing, setSyncing] = useState(false);
  const [remote, setRemote] = useState<Remote>({ status: 'loading' });
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const profile = useProfile();

  const loadFeed = useCallback(async () => {
    try {
      const items = await fetchFeed();
      setRemote({ status: 'ready', items, done: items.length < 20 });
    } catch {
      setRemote({ status: 'offline' });
    }
    fetchUnreadCount().then(setUnread).catch(() => {});
  }, []);

  // Synk og hent feeden hver gang Hjem vises; oppdater visningen etterpå.
  useFocusEffect(
    useCallback(() => {
      syncPendingWorkouts(db)
        .catch(() => {})
        .then(() => {
          reload();
          return loadFeed();
        });
    }, [db, reload, loadFeed]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await syncPendingWorkouts(db).catch(() => {});
    reload();
    await loadFeed();
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (remote.status !== 'ready' || remote.done || loadingMore || remote.items.length === 0) return;
    setLoadingMore(true);
    try {
      const more = await fetchFeed(remote.items[remote.items.length - 1].startedAt);
      setRemote({ status: 'ready', items: [...remote.items, ...more.filter((m) => !remote.items.some((i) => i.id === m.id))], done: more.length < 20 });
    } catch {
      // Prøver igjen ved neste rulling.
    } finally {
      setLoadingMore(false);
    }
  };

  const data = state.status === 'ready' ? state.data : null;
  const derived = useMemo(() => {
    if (!data) return null;
    return {
      summary: weeklySummary(data.workouts),
      streak: weekStreak(data.workouts),
      records: recordSummaryPerWorkout(data.workouts),
    };
  }, [data]);
  const unsynced = data ? data.sync.pending + data.sync.failed : 0;

  const localIds = useMemo(() => new Set((data?.workouts ?? []).map((w) => w.id)), [data]);
  const [onlyMine, setOnlyMine] = useState(false);
  const chooseFeed = () =>
    Alert.alert('Vis i feeden', undefined, [
      { text: 'Alle (deg og dem du følger)', onPress: () => setOnlyMine(false) },
      { text: 'Bare mine økter', onPress: () => setOnlyMine(true) },
      { text: 'Avbryt', style: 'cancel' },
    ]);

  const allRows: Row[] = useMemo(() => {
    const local = data?.workouts ?? [];
    if (remote.status !== 'ready') return local.map((workout) => ({ kind: 'local' as const, workout }));
    const remoteIds = new Set(remote.items.map((i) => i.id));
    // Egne økter som ikke er på serveren ennå (venter på synk), flettes inn etter tidspunkt.
    const pending = local.filter((w) => !remoteIds.has(w.id) && w.syncStatus !== 'synced');
    const all: Row[] = [
      ...remote.items.map((item) => ({ kind: 'remote' as const, item })),
      ...pending.map((workout) => ({ kind: 'local' as const, workout })),
    ];
    return all.sort((a, b) =>
      (b.kind === 'remote' ? b.item.startedAt : b.workout.startedAt).localeCompare(a.kind === 'remote' ? a.item.startedAt : a.workout.startedAt),
    );
  }, [data, remote]);

  const updateItem = (next: FeedItem) =>
    setRemote((r) => (r.status === 'ready' ? { ...r, items: r.items.map((i) => (i.id === next.id ? next : i)) } : r));

  const syncNow = async () => {
    setSyncing(true);
    await retryFailed(db);
    await syncPendingWorkouts(db).catch(() => {});
    setSyncing(false);
    reload();
  };

  const rows = onlyMine ? allRows.filter((r) => r.kind === 'local' || r.item.author.isSelf) : allRows;

  const header = (
    <View style={styles.headerBlock}>
      {derived && (
        <WeeklySummary
          current={derived.summary.current}
          previous={derived.summary.previous}
          streak={derived.streak}
          goal={data?.settings.weeklyWorkoutGoal ?? null}
        />
      )}
      {unsynced > 0 && (
        <ThemedView type="backgroundElement" style={styles.syncCard}>
          <ThemedText type="small" style={styles.syncText}>
            {unsynced === 1 ? '1 økt er' : `${unsynced} økter er`} bare lagret på telefonen.
          </ThemedText>
          <Button label="Synk nå" variant="secondary" onPress={syncNow} loading={syncing} style={styles.syncButton} />
        </ThemedView>
      )}
      {remote.status === 'offline' && (
        <ThemedView type="backgroundElement" style={styles.syncCard}>
          <Icon name="wifi.slash" size={16} color={theme.textSecondary} fallback="" />
          <ThemedText type="small" style={styles.syncText}>
            Ingen kontakt med serveren. Viser bare dine egne økter.
          </ThemedText>
        </ThemedView>
      )}
      <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
    </View>
  );

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <Pressable onPress={() => router.push('/me')} accessibilityRole="button" accessibilityLabel="Din profil">
              <Avatar size={44} />
            </Pressable>
            <Pressable
              onPress={() => router.navigate({ pathname: '/explore', params: { tab: 'people' } })}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Finn folk å følge"
              style={styles.iconButton}>
              <Icon name="person.badge.plus" size={24} color={theme.text} fallback="+" />
            </Pressable>
          </View>
          <Pressable
            onPress={chooseFeed}
            accessibilityRole="button"
            accessibilityLabel={`Feed: ${onlyMine ? 'bare mine økter' : 'alle'}`}
            accessibilityHint="Velg hva feeden viser"
            style={styles.titleButton}>
            <ThemedText type="smallBold" style={styles.topTitle} accessibilityRole="header">
              {onlyMine ? 'Mine økter' : 'Hjem'}
            </ThemedText>
            <Icon name="chevron.down" size={14} color={theme.text} fallback="⌄" />
          </Pressable>
          <View style={styles.topRight}>
          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Varsler, ${unread} nye` : 'Varsler'}
            style={styles.topSide}>
            <Icon name="bell" size={24} color={theme.text} fallback="🔔" />
            {unread > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.dangerFill }]}>
                <ThemedText style={styles.badgeText}>{unread > 9 ? '9+' : unread}</ThemedText>
              </View>
            )}
          </Pressable>
          </View>
        </View>

        <FlatList
          data={rows}
          keyExtractor={(r) => (r.kind === 'remote' ? r.item.id : `local-${r.workout.id}`)}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.backgroundElement }]} />}
          renderItem={({ item: row }) => (
            <Animated.View entering={FadeIn.duration(220)}>
            {row.kind === 'remote' ? (
              <FeedCard
                item={
                  row.item.author.isSelf && row.item.photoUrls.length === 0 && data?.photos.get(row.item.id)
                    ? { ...row.item, photoUrls: data.photos.get(row.item.id)! }
                    : row.item
                }
                records={row.item.author.isSelf ? derived?.records.get(row.item.id) : undefined}
                onChange={updateItem}
                onOpen={
                  row.item.author.isSelf && localIds.has(row.item.id)
                    ? () => router.push({ pathname: '/history/[id]', params: { id: row.item.id } })
                    : undefined
                }
              />
            ) : (
              <FeedCard
                item={localFeedItem(row.workout, profile, data?.photos.get(row.workout.id))}
                syncStatus={row.workout.syncStatus}
                records={derived?.records.get(row.workout.id)}
              />
            )}
            </Animated.View>
          )}
          ListEmptyComponent={
            !data || remote.status === 'loading' ? (
              <FeedSkeleton />
            ) : onlyMine ? (
              <EmptyState
                icon="figure.strengthtraining.traditional"
                title="Ingen økter ennå"
                text="Start din første økt, så dukker den opp her."
                action={{ label: 'Start en økt', onPress: () => router.navigate('/start') }}
              />
            ) : (
              <EmptyState
                icon="person.2"
                title="Feeden din er tom"
                text="Start en økt, eller følg venner for å se treningen deres her."
                action={{ label: 'Finn folk å følge', onPress: () => router.navigate({ pathname: '/explore', params: { tab: 'people' } }) }}
              />
            )
          }
          ListFooterComponent={
            <View style={styles.footer}>{loadingMore && <ActivityIndicator style={styles.more} />}</View>
          }
        />
      </SafeAreaView>
      {data && <StartWorkoutButton active={data.active} />}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  topLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  topRight: { flex: 1, alignItems: 'flex-end' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: Spacing.two },
  topTitle: { textAlign: 'center', fontSize: 20 },
  topSide: { width: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  badge: { position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontWeight: 700 },
  emptyBox: { gap: Spacing.three, alignItems: 'flex-start' },
  more: { marginTop: Spacing.three },
  list: { paddingHorizontal: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  headerBlock: { paddingTop: Spacing.three, gap: Spacing.three },
  syncCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Radius.medium, padding: Spacing.two, paddingLeft: Spacing.three },
  syncText: { flex: 1 },
  syncButton: { minHeight: 36, paddingHorizontal: Spacing.three },
  divider: { height: StyleSheet.hairlineWidth, marginTop: Spacing.two },
  separator: { height: 8, marginHorizontal: -Spacing.four },
  empty: { paddingVertical: Spacing.four },
  footer: { height: 160 },
});
