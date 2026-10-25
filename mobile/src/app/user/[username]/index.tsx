import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { confirmBlock, confirmUnblock, openReport } from '@/features/safety/actions';
import { FollowButton } from '@/features/social/follow-button';
import { UserAvatar } from '@/features/social/user-avatar';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/services/api';
import { type PublicProfile, fetchPublicProfile } from '@/services/profile';
import { type FeedItem, fetchUserFeed } from '@/services/feed';
import type { FollowStatus } from '@/services/social';
import { FeedCard } from '@/features/social/feed-card';
import { SharedLibrary } from '@/features/explore/shared-library';
import { MaxContentWidth, Radius, Spacing } from '@/theme';

type State = { status: 'loading' } | { status: 'ready'; profile: PublicProfile } | { status: 'error'; message: string };

const SOCIAL: { key: 'instagram' | 'tiktok' | 'youtube'; label: string; url: (h: string) => string }[] = [
  { key: 'instagram', label: 'Instagram', url: (h) => `https://instagram.com/${h}` },
  { key: 'tiktok', label: 'TikTok', url: (h) => `https://tiktok.com/@${h}` },
  { key: 'youtube', label: 'YouTube', url: (h) => `https://youtube.com/@${h}` },
];

/**
 * En brukers profil slik du ser den: bilde, navn, tall, følg-knapp og (for følgere) øktene.
 * Private profiler viser bare navn, bilde og bio til andre enn godtatte følgere.
 */
export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const theme = useTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [workouts, setWorkouts] = useState<FeedItem[] | null>(null);
  const [version, setVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState<'idle' | 'loading' | 'done'>('idle');

  useEffect(() => {
    let active = true;
    fetchPublicProfile(username)
      .then((profile) => {
        if (!active) return;
        setState({ status: 'ready', profile });
        setRefreshing(false);
        if (profile.canViewWorkouts) {
          fetchUserFeed(username)
            .then((items) => {
              if (!active) return;
              setWorkouts(items);
              setMore(items.length < 20 ? 'done' : 'idle');
            })
            .catch(() => active && setWorkouts([]));
        } else {
          setWorkouts(null);
        }
      })
      .catch(
        (e: unknown) =>
          active &&
          (setRefreshing(false),
          setState({
            status: 'error',
            message: e instanceof ApiError && e.status === 404 ? 'Fant ingen bruker med dette brukernavnet.' : 'Kunne ikke hente profilen. Har du nett?',
          })),
      );
    return () => {
      active = false;
    };
  }, [username, version]);

  const loadMore = async () => {
    if (!workouts || workouts.length === 0 || more !== 'idle') return;
    setMore('loading');
    try {
      const next = await fetchUserFeed(username, workouts[workouts.length - 1].startedAt);
      setWorkouts([...workouts, ...next.filter((n) => !workouts.some((w) => w.id === n.id))]);
      setMore(next.length < 20 ? 'done' : 'idle');
    } catch {
      setMore('idle');
    }
  };

  // Ny følgestatus endrer hva man får se (tall og økter), så profilen hentes på nytt.
  const onFollowChange = useCallback((_status: FollowStatus) => setVersion((v) => v + 1), []);

  if (state.status !== 'ready') {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: `@${username}` }} />
        {state.status === 'loading' ? (
          <View style={styles.loadingBox} accessible accessibilityLabel="Laster">
            <Skeleton width={112} height={112} radius={56} />
            <Skeleton width={180} height={26} />
            <Skeleton width={120} height={16} />
          </View>
        ) : (
          <EmptyState icon="person.crop.circle.badge.questionmark" title={state.message} />
        )}
      </View>
    );
  }

  const p = state.profile;
  const links = [
    ...SOCIAL.filter((s) => p[s.key]).map((s) => ({ label: `${s.label}: @${p[s.key]}`, url: s.url(p[s.key]!) })),
    ...(p.website ? [{ label: p.website.replace(/^https?:\/\//, ''), url: /^https?:\/\//.test(p.website) ? p.website : `https://${p.website}` }] : []),
  ];
  const reload = () => setVersion((v) => v + 1);
  const openMenu = () =>
    Alert.alert(`@${p.username}`, undefined, [
      { text: 'Rapporter profilen', onPress: () => openReport('USER', p.id, p.username) },
      p.blockedByYou
        ? { text: 'Opphev blokkering', onPress: () => confirmUnblock(p.username, reload) }
        : { text: 'Blokker', style: 'destructive' as const, onPress: () => confirmBlock(p.username, reload) },
      { text: 'Avbryt', style: 'cancel' as const },
    ]);
  const openList = (list: 'followers' | 'following') =>
    p.followerCount !== null &&
    router.push({ pathname: list === 'followers' ? '/user/[username]/followers' : '/user/[username]/following', params: { username: p.username } });

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            setVersion((v) => v + 1);
          }}
        />
      }>
      <Stack.Screen
        options={{
          title: `@${p.username}`,
          headerRight: p.isSelf
            ? undefined
            : () => (
                <Pressable onPress={openMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Valg for @${p.username}`}>
                  <Icon name="ellipsis" color={theme.text} fallback="⋯" />
                </Pressable>
              ),
        }}
      />
      <UserAvatar uri={p.avatarUrl} size={112} />
      <View style={styles.nameRow}>
        <ThemedText style={styles.name}>{p.displayName}</ThemedText>
        {p.isPrivate && <Icon name="lock.fill" size={16} color={theme.textSecondary} fallback="🔒" />}
      </View>
      <ThemedText themeColor="textSecondary">
        @{p.username}
        {p.followsYou ? '  ·  Følger deg' : ''}
      </ThemedText>
      {p.bio && <ThemedText style={styles.bio}>{p.bio}</ThemedText>}

      <View style={styles.stats}>
        <Stat value={p.workoutCount} label="Treninger" />
        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
        <Stat value={p.followerCount} label="Følgere" onPress={() => openList('followers')} />
        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
        <Stat value={p.followingCount} label="Følger" onPress={() => openList('following')} />
      </View>

      {p.blockedByYou ? (
        <View style={[styles.box, styles.locked, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="hand.raised.fill" size={22} color={theme.textSecondary} fallback="✋" />
          <ThemedText accessibilityRole="header" style={styles.lockedTitle}>Du har blokkert @{p.username}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            Dere ser ikke hverandres innhold. Brukeren har ikke fått beskjed.
          </ThemedText>
          <Pressable
            onPress={() => confirmUnblock(p.username, reload)}
            accessibilityRole="button"
            style={[styles.unblock, { backgroundColor: theme.background }]}>
            <ThemedText type="smallBold">Opphev blokkering</ThemedText>
          </Pressable>
        </View>
      ) : p.isSelf ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          Slik ser andre profilen din{p.isPrivate ? '. Den er privat: bare følgere ser tall og økter.' : '.'}
        </ThemedText>
      ) : (
        <FollowButton username={p.username} status={p.followStatus} followsYou={p.followsYou} onChange={onFollowChange} />
      )}

      {links.length > 0 && p.workoutCount !== null && (
        <View style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
          {links.map((l, i) => (
            <Pressable
              key={l.url}
              onPress={() => Linking.openURL(l.url)}
              accessibilityRole="link"
              style={[styles.link, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
              <ThemedText style={[styles.flex, { color: theme.accent }]} numberOfLines={1}>
                {l.label}
              </ThemedText>
              <Icon name="arrow.up.right" size={14} color={theme.textSecondary} fallback="↗" />
            </Pressable>
          ))}
        </View>
      )}

      {!p.blockedByYou && (
        <View style={styles.bleed}>
          <SharedLibrary username={p.username} version={version} isSelf={p.isSelf} />
        </View>
      )}

      {p.blockedByYou ? null : !p.canViewWorkouts ? (
        <View style={[styles.box, styles.locked, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="lock.fill" size={22} color={theme.textSecondary} fallback="🔒" />
          <ThemedText accessibilityRole="header" style={styles.lockedTitle}>
            {p.followStatus === 'PENDING' ? 'Forespørselen venter på svar' : `Følg ${p.displayName.split(' ')[0]} for å se øktene`}
          </ThemedText>
          {p.isPrivate && p.followStatus === 'NONE' && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Profilen er privat, så forespørselen må godkjennes.
            </ThemedText>
          )}
        </View>
      ) : (
        <View style={styles.workouts}>
          <ThemedText accessibilityRole="header" style={styles.section}>Økter</ThemedText>
          {workouts === null ? (
            <ActivityIndicator />
          ) : workouts.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              {p.isSelf || p.followStatus === 'FOLLOWING' ? 'Ingen økter ennå.' : 'Ingen offentlige økter. Følg for å se økter for følgere.'}
            </ThemedText>
          ) : (
            <>
              {workouts.map((w) => (
                <View key={w.id} style={[styles.post, { borderTopColor: theme.backgroundElement }]}>
                  <FeedCard item={w} onChange={(next) => setWorkouts((list) => list?.map((x) => (x.id === next.id ? next : x)) ?? null)} />
                </View>
              ))}
              {more !== 'done' && (
                <Pressable onPress={loadMore} disabled={more === 'loading'} accessibilityRole="button" style={styles.more}>
                  {more === 'loading' ? (
                    <ActivityIndicator />
                  ) : (
                    <ThemedText type="smallBold" style={{ color: theme.accent }}>
                      Vis flere økter
                    </ThemedText>
                  )}
                </Pressable>
              )}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ value, label, onPress }: { value: number | null; label: string; onPress?: () => void }) {
  const content = (
    <>
      <ThemedText style={styles.statValue}>{value ?? '–'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.stat}>
      {content}
    </Pressable>
  ) : (
    <View style={styles.stat}>{content}</View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  centerText: { textAlign: 'center' },
  loadingBox: { alignItems: 'center', gap: Spacing.three },
  content: { alignItems: 'center', padding: Spacing.four, gap: Spacing.two, paddingBottom: 60, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.two },
  name: { fontSize: 28, lineHeight: 34, fontWeight: 700 },
  bio: { textAlign: 'center', marginTop: Spacing.one },
  note: { textAlign: 'center' },
  stats: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginVertical: Spacing.three },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, lineHeight: 26, fontWeight: 700, fontVariant: ['tabular-nums'] },
  divider: { width: 1, height: 32 },
  box: { alignSelf: 'stretch', borderRadius: Radius.large, paddingHorizontal: Spacing.three, marginTop: Spacing.three },
  link: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: Spacing.two },
  locked: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  lockedTitle: { fontWeight: 700, textAlign: 'center' },
  workouts: { alignSelf: 'stretch', gap: Spacing.two, marginTop: Spacing.three },
  section: { fontSize: 20, fontWeight: 700 },
  more: { alignItems: 'center', paddingVertical: Spacing.three },
  post: { borderTopWidth: 8, marginHorizontal: -Spacing.four, paddingHorizontal: Spacing.four },
  flex: { flex: 1 },
  unblock: { minHeight: 44, paddingHorizontal: Spacing.four, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.two },
  // Karusellene går helt ut til kanten; titlene får innrykk igjen inne i komponenten.
  bleed: { alignSelf: 'stretch', marginHorizontal: -Spacing.four, paddingHorizontal: 0 },
});
