import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { confirmUnblock } from '@/features/safety/actions';
import { UserRow } from '@/features/social/user-row';
import { useTheme } from '@/hooks/use-theme';
import { fetchBlockedUsers } from '@/services/safety';
import type { UserSummary } from '@/services/social';
import { MaxContentWidth, Spacing } from '@/theme';

/** Brukere du har blokkert, med «Opphev». */
export default function BlockedUsersScreen() {
  const theme = useTheme();
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ready'; users: UserSummary[] } | { status: 'error' }>({
    status: 'loading',
  });

  const load = useCallback(() => {
    fetchBlockedUsers()
      .then((users) => setState({ status: 'ready', users }))
      .catch(() => setState({ status: 'error' }));
  }, []);
  useFocusEffect(load);

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Blokkerte brukere' }} />
      {state.status === 'loading' ? (
        <ActivityIndicator style={styles.loading} />
      ) : state.status === 'error' ? (
        <ThemedText themeColor="textSecondary" style={styles.message}>
          Kunne ikke hente listen. Har du nett?
        </ThemedText>
      ) : (
        <FlatList
          data={state.users}
          keyExtractor={(u) => u.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              right={
                <Pressable
                  onPress={() => confirmUnblock(item.username, load)}
                  accessibilityRole="button"
                  accessibilityLabel={`Opphev blokkering av ${item.displayName}`}
                  style={[styles.unblock, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">Opphev</ThemedText>
                </Pressable>
              }
            />
          )}
          ListEmptyComponent={
            <EmptyState icon="hand.raised" title="Ingen blokkerte brukere" text="Du kan blokkere fra «…»-menyen på en profil." />
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
  unblock: { minHeight: 44, minWidth: 88, paddingHorizontal: Spacing.three, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
