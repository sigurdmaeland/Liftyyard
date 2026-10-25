import { Stack, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { UserRow } from '@/features/social/user-row';
import { useTheme } from '@/hooks/use-theme';
import type { UserSummary } from '@/services/social';
import { MaxContentWidth, Spacing } from '@/theme';

type State = { status: 'loading' } | { status: 'ready'; users: UserSummary[] } | { status: 'error'; message: string };

/** Felles skjerm for lister av brukere (følgere, følger, forespørsler). */
export function UserListScreen({
  title,
  load,
  empty,
  renderRight,
}: {
  title: string;
  load: () => Promise<UserSummary[]>;
  empty: string;
  /** Egne knapper til høyre (f.eks. Godta/Avslå). Får en funksjon som fjerner raden fra listen. */
  renderRight?: (user: UserSummary, remove: () => void) => ReactNode;
}) {
  const theme = useTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load()
        .then((users) => active && setState({ status: 'ready', users }))
        .catch((e: unknown) => active && setState({ status: 'error', message: e instanceof Error ? e.message : 'Kunne ikke hente listen' }));
      return () => {
        active = false;
      };
    }, [load]),
  );

  const update = (id: string, patch: Partial<UserSummary> | null) =>
    setState((s) =>
      s.status === 'ready'
        ? { ...s, users: patch === null ? s.users.filter((u) => u.id !== id) : s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }
        : s,
    );

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title }} />
      {state.status === 'loading' ? (
        <ActivityIndicator style={styles.loading} />
      ) : state.status === 'error' ? (
        <ThemedText themeColor="textSecondary" style={styles.message}>
          {state.message}
        </ThemedText>
      ) : (
        <FlatList
          data={state.users}
          keyExtractor={(u) => u.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load()
                  .then((users) => setState({ status: 'ready', users }))
                  .catch(() => {})
                  .finally(() => setRefreshing(false));
              }}
            />
          }
          renderItem={({ item }) => (
            <UserRow
              user={item}
              onStatusChange={(followStatus) => update(item.id, { followStatus })}
              right={renderRight?.(item, () => update(item.id, null))}
            />
          )}
          ListEmptyComponent={
            <EmptyState icon="person.2" title={empty} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { paddingHorizontal: Spacing.four, paddingBottom: 60, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  loading: { marginTop: Spacing.five },
  message: { textAlign: 'center', marginTop: Spacing.five, paddingHorizontal: Spacing.four },
});
