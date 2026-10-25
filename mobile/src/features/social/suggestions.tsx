import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ListSkeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { UserRow } from '@/features/social/user-row';
import { type Suggestion, fetchSuggestions } from '@/services/social';
import { Spacing } from '@/theme';

/** «Forslag til deg»: venners venner først, deretter populære profiler. Vises før man søker. */
export function PeopleSuggestions() {
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchSuggestions()
      .then((s) => active && setList(s))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  if (failed) return <EmptyState icon="wifi.slash" title="Forslag krever nett" text="Søk etter navn eller @brukernavn når du er på nett." />;
  if (list === null) return <ListSkeleton rows={5} />;
  if (list.length === 0) {
    return <EmptyState icon="person.2" title="Finn folk å trene med" text="Søk etter navn eller @brukernavn i feltet over." />;
  }
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ThemedText accessibilityRole="header" style={styles.title}>
        Forslag til deg
      </ThemedText>
      {list.map((s) => (
        <View key={s.user.id}>
          <UserRow
            user={s.user}
            onStatusChange={(followStatus) => setList((l) => l?.map((x) => (x.user.id === s.user.id ? { ...x, user: { ...x.user, followStatus } } : x)) ?? null)}
          />
          {s.mutualCount > 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.mutual}>
              Følges av {s.mutualCount} du følger
            </ThemedText>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: 120 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: 700, marginBottom: Spacing.two },
  mutual: { marginLeft: 64, marginTop: -Spacing.two, marginBottom: Spacing.two },
});
