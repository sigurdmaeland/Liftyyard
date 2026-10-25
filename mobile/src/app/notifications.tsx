import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/empty-state';
import { ListSkeleton } from '@/components/skeleton';
import { UserAvatar } from '@/features/social/user-avatar';
import { useTheme } from '@/hooks/use-theme';
import { formatRelativeDateTime } from '@/lib/stats';
import { type AppNotification, fetchNotifications, markNotificationsRead } from '@/services/feed';
import { MaxContentWidth, Spacing } from '@/theme';

type State = { status: 'loading' } | { status: 'ready'; items: AppNotification[] } | { status: 'error' };

function text(n: AppNotification): string {
  switch (n.type) {
    case 'FOLLOW':
      return 'begynte å følge deg.';
    case 'FOLLOW_REQUEST':
      return 'vil følge deg.';
    case 'FOLLOW_ACCEPTED':
      return 'godtok forespørselen din.';
    case 'LIKE':
      return `likte «${n.workoutName ?? 'økten din'}».`;
    case 'COMMENT':
      return `kommenterte «${n.workoutName ?? 'økten din'}»: ${n.commentPreview ?? ''}`;
    case 'COMMENT_LIKE':
      return `likte kommentaren din: ${n.commentPreview ?? ''}`;
    case 'REPLY':
      return `svarte deg: ${n.commentPreview ?? ''}`;
    case 'MENTION':
      return `nevnte deg i en kommentar: ${n.commentPreview ?? ''}`;
    case 'TAG':
      return `la deg til som treningspartner i «${n.workoutName ?? 'en økt'}».`;
    case 'DOWNLOAD':
      return n.programId
        ? `lastet ned programmet ditt «${n.targetName ?? 'et program'}».`
        : `lastet ned rutinen din «${n.targetName ?? 'en rutine'}».`;
  }
}

/** Varsler: følgere, forespørsler, liker, kommentarer og nedlastinger. Alle markeres som lest når listen vises. */
export default function NotificationsScreen() {
  const theme = useTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchNotifications()
        .then((items) => {
          if (!active) return;
          setState({ status: 'ready', items });
          if (items.some((n) => !n.read)) markNotificationsRead().catch(() => {});
        })
        .catch(() => active && setState({ status: 'error' }));
      return () => {
        active = false;
      };
    }, []),
  );

  const open = (n: AppNotification) => {
    if (n.type === 'FOLLOW_REQUEST') router.push('/me/requests');
    else if (n.type === 'DOWNLOAD' && n.programId) router.push({ pathname: '/program/[id]', params: { id: n.programId } });
    else if (n.type === 'DOWNLOAD' && n.routineId) router.push({ pathname: '/routine/[id]', params: { id: n.routineId } });
    else if (n.workoutId && ['COMMENT', 'REPLY', 'MENTION', 'COMMENT_LIKE'].includes(n.type))
      router.push({ pathname: '/post/[id]/comments', params: { id: n.workoutId } });
    else if (n.workoutId) router.push({ pathname: '/post/[id]', params: { id: n.workoutId } });
    else router.push({ pathname: '/user/[username]', params: { username: n.actor.username } });
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Varsler' }} />
      {state.status === 'loading' ? (
        <ListSkeleton />
      ) : state.status === 'error' ? (
        <ThemedText themeColor="textSecondary" style={styles.message}>
          Kunne ikke hente varsler. Har du nett?
        </ThemedText>
      ) : (
        <FlatList
          data={state.items}
          keyExtractor={(n) => n.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchNotifications()
                  .then((items) => setState({ status: 'ready', items }))
                  .catch(() => {})
                  .finally(() => setRefreshing(false));
              }}
            />
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item)} accessibilityRole="button" style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
              <UserAvatar uri={item.actor.avatarUrl} size={44} />
              <View style={styles.text}>
                <ThemedText numberOfLines={3}>
                  <ThemedText style={styles.bold}>{item.actor.displayName}</ThemedText> {text(item)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatRelativeDateTime(item.createdAt)}
                </ThemedText>
              </View>
              {!item.read && <View style={[styles.dot, { backgroundColor: theme.accent }]} />}
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="bell"
              title="Ingen varsler ennå"
              text="Når noen følger deg, liker eller kommenterer øktene dine, eller laster ned programmene dine, dukker det opp her."
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { marginTop: Spacing.five },
  message: { textAlign: 'center', marginTop: Spacing.five, paddingHorizontal: Spacing.four },
  list: { paddingHorizontal: Spacing.four, paddingBottom: 60, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  text: { flex: 1, gap: 2 },
  bold: { fontWeight: 700 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
