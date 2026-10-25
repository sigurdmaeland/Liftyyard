import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
import { EmptyState } from '@/components/empty-state';
import { ListSkeleton } from '@/components/skeleton';
import { UserAvatar } from '@/features/social/user-avatar';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { fetchWorkoutView, setWorkoutPartners } from '@/services/feed';
import { type UserSummary, fetchFollowers, fetchFollowing } from '@/services/social';
import { MaxContentWidth, Radius, Spacing } from '@/theme';

const MAX = 10;

/** Velg hvem du trente med. Bare folk du følger eller som følger deg kan velges. */
export default function PartnersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { username } = useProfile();
  const [people, setPeople] = useState<UserSummary[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!username) return;
    let active = true;
    Promise.all([fetchFollowing(username), fetchFollowers(username), fetchWorkoutView(id)])
      .then(([following, followers, view]) => {
        if (!active) return;
        const byName = new Map<string, UserSummary>();
        for (const u of [...following, ...followers]) if (!u.isSelf) byName.set(u.username, u);
        setPeople([...byName.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'nb')));
        setSelected(new Set((view.summary.partners ?? []).map((p) => p.username)));
      })
      .catch(() => active && setPeople([]));
    return () => {
      active = false;
    };
  }, [id, username]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people ?? []).filter((u) => !q || u.username.includes(q) || u.displayName.toLowerCase().includes(q));
  }, [people, query]);

  const toggle = (u: UserSummary) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(u.username)) next.delete(u.username);
      else if (next.size < MAX) next.add(u.username);
      else Alert.alert(`Maks ${MAX} treningspartnere`);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      await setWorkoutPartners(id, [...selected]);
      router.back();
    } catch (e) {
      setSaving(false);
      Alert.alert('Kunne ikke lagre', e instanceof Error ? e.message : 'Prøv igjen når du har nett.');
    }
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Trente med' }} />
      {people === null ? (
        <ListSkeleton />
      ) : people.length === 0 ? (
        <EmptyState icon="person.2" title="Ingen å velge ennå" text="Du kan legge til folk du følger eller som følger deg." />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Søk"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Søk blant dem du følger"
              autoCapitalize="none"
              style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <UserAvatar uri={item.avatarUrl} size={40} />
              <View style={styles.flex}>
                <Checkbox checked={selected.has(item.username)} onChange={() => toggle(item)} label={`${item.displayName} (@${item.username})`} />
              </View>
            </View>
          )}
        />
      )}
      <View style={[styles.bottom, { borderTopColor: theme.backgroundSelected }]}>
        <Button label={selected.size > 0 ? `Lagre (${selected.size})` : 'Lagre'} onPress={save} loading={saving} disabled={people === null} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: Spacing.four, gap: Spacing.one, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  search: { minHeight: 44, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, fontSize: 16, marginBottom: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  bottom: { padding: Spacing.four, paddingBottom: Spacing.five, borderTopWidth: StyleSheet.hairlineWidth },
});
