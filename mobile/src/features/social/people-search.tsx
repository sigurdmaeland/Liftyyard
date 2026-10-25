import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { UserRow } from '@/features/social/user-row';
import { type UserSummary, searchUsers } from '@/services/social';
import { Spacing } from '@/theme';
import { EmptyState } from '@/components/empty-state';
import { ListSkeleton } from '@/components/skeleton';
import { PeopleSuggestions } from '@/features/social/suggestions';

type State = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; users: UserSummary[] } | { status: 'error' };

/** Søkeresultater for personer (Utforsk → Personer). Søker når man har skrevet minst 2 tegn. */
export function PeopleSearch({ query }: { query: string }) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const q = query.trim();

  useEffect(() => {
    if (q.replace(/^@/, '').length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      setState({ status: 'loading' });
      searchUsers(q)
        .then((users) => active && setState({ status: 'ready', users }))
        .catch(() => active && setState({ status: 'error' }));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q]);

  const setStatus = (id: string, followStatus: UserSummary['followStatus']) =>
    setState((s) => (s.status === 'ready' ? { ...s, users: s.users.map((u) => (u.id === id ? { ...u, followStatus } : u)) } : s));

  if (q.replace(/^@/, '').length < 2) return <PeopleSuggestions />;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
      {state.status === 'loading' && <ListSkeleton rows={4} />}
      {state.status === 'error' && (
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Søket krever nett.
        </ThemedText>
      )}
      {state.status === 'ready' && state.users.length === 0 && (
        <EmptyState icon="magnifyingglass" title={`Ingen treff på «${q}»`} text="Sjekk stavemåten, eller søk på @brukernavn." />
      )}
      {state.status === 'ready' &&
        state.users.map((u) => <UserRow key={u.id} user={u} onStatusChange={(s) => setStatus(u.id, s)} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: 120 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four, paddingBottom: 120 },
  emptyTitle: { fontSize: 20, fontWeight: 700 },
  center: { textAlign: 'center' },
  loading: { marginTop: Spacing.four },
});
