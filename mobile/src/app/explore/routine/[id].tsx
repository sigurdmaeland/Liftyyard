import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { refreshAfterDownload } from '@/features/explore/after-download';
import { AuthorRow } from '@/features/explore/author-row';
import { openReport } from '@/features/safety/actions';
import { CreditLine } from '@/features/explore/credit-line';
import { Fact, RoutineExercises } from '@/features/explore/routine-exercises';
import { downloadsLabel } from '@/features/explore/program-card';
import { VISIBILITY_ICONS } from '@/features/workout/visibility-picker';
import { useTheme } from '@/hooks/use-theme';
import { uuidv7 } from '@/lib/ids';
import { downloadRoutine, fetchExploreRoutine } from '@/services/explore';
import { findDownloadedRoutine, saveDownloadedRoutine } from '@/storage/program-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';
import type { ExploreRoutine } from '@/types/explore';
import { VISIBILITY_LABELS } from '@/types/workout';

type State =
  | { status: 'loading' }
  | { status: 'ready'; routine: ExploreRoutine; copyId: string | null }
  | { status: 'error'; message: string };

/** En delt rutine fra en annen bruker, med «Last ned til biblioteket». */
export default function ExploreRoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const theme = useTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([fetchExploreRoutine(id), findDownloadedRoutine(db, id)])
      .then(([routine, copyId]) => active && setState({ status: 'ready', routine, copyId }))
      .catch((e: unknown) => active && setState({ status: 'error', message: e instanceof Error ? e.message : 'Ukjent feil' }));
    return () => {
      active = false;
    };
  }, [db, id]);

  if (state.status === 'loading') {
    return (
      <ThemedView style={[styles.fill, styles.center]}>
        <ActivityIndicator />
      </ThemedView>
    );
  }
  if (state.status === 'error') {
    return (
      <ThemedView style={[styles.fill, styles.center]}>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          Fant ikke rutinen. Den kan være slettet eller ikke lenger delt med deg.
        </ThemedText>
      </ThemedView>
    );
  }
  const { routine: r, copyId } = state;
  const exercises = r.routine?.exercises ?? [];

  const download = async () => {
    setDownloading(true);
    try {
      const copy = await downloadRoutine(r.id, uuidv7());
      await refreshAfterDownload(db);
      await saveDownloadedRoutine(db, copy);
      router.replace({ pathname: '/routine/[id]', params: { id: copy.id } });
    } catch (e) {
      setDownloading(false);
      Alert.alert('Kunne ikke laste ned', e instanceof Error ? e.message : 'Prøv igjen når du har nett.');
    }
  };

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen
        options={{
          title: 'Rutine',
          headerRight: r.mine
            ? undefined
            : () => (
                <Pressable
                  onPress={() => openReport('ROUTINE', r.id, r.author.username)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Rapporter rutinen">
                  <Icon name="flag" color={theme.text} fallback="⚑" />
                </Pressable>
              ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <ThemedText accessibilityRole="header" style={styles.title}>{r.name}</ThemedText>
        <View style={[styles.authorBox, { backgroundColor: theme.backgroundElement }]}>
          <AuthorRow author={r.author} mine={r.mine} />
        </View>
        {r.basedOn && <CreditLine credit={r.basedOn} />}

        <View style={styles.facts}>
          <Fact icon="list.bullet" text={`${r.exerciseCount} ${r.exerciseCount === 1 ? 'øvelse' : 'øvelser'} · ${r.setCount} sett`} />
          <Fact icon="arrow.down.circle" text={downloadsLabel(r.downloadCount)} />
          <Fact icon={VISIBILITY_ICONS[r.visibility]} text={VISIBILITY_LABELS[r.visibility]} />
        </View>

        {r.mine ? (
          <Button label="Åpne i biblioteket" onPress={() => router.replace({ pathname: '/routine/[id]', params: { id: r.id } })} />
        ) : copyId ? (
          <Button label="Åpne kopien i biblioteket" onPress={() => router.replace({ pathname: '/routine/[id]', params: { id: copyId } })} />
        ) : (
          <Button label="Last ned til biblioteket" onPress={download} loading={downloading} />
        )}

        {r.notes && <ThemedText style={styles.notes}>{r.notes}</ThemedText>}

        <ThemedText accessibilityRole="header" style={styles.section}>Øvelser</ThemedText>
        <RoutineExercises exercises={exercises} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  centerText: { textAlign: 'center' },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 700 },
  authorBox: { padding: Spacing.three, borderRadius: Radius.large },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  notes: { fontSize: 16, lineHeight: 23 },
  section: { fontSize: 20, lineHeight: 26, fontWeight: 700, marginTop: Spacing.two },
});
