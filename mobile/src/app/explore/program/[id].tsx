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
import { downloadsLabel } from '@/features/explore/program-card';
import { LEVEL_LABELS, ProgramCover } from '@/features/explore/program-cover';
import { Fact, RoutineExercises } from '@/features/explore/routine-exercises';
import { VISIBILITY_ICONS } from '@/features/workout/visibility-picker';
import { useTheme } from '@/hooks/use-theme';
import { uuidv7 } from '@/lib/ids';
import { downloadProgram, fetchExploreProgram } from '@/services/explore';
import { findDownloadedCopy, saveDownloadedProgram } from '@/storage/program-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';
import type { ExploreProgram } from '@/types/explore';
import { VISIBILITY_LABELS } from '@/types/workout';

type State =
  | { status: 'loading' }
  | { status: 'ready'; program: ExploreProgram; copyId: string | null }
  | { status: 'error'; message: string };

/** Detaljer for et delt program (fra appen eller en annen bruker), med «Last ned til biblioteket». */
export default function ExploreProgramScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const theme = useTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([fetchExploreProgram(id), findDownloadedCopy(db, id)])
      .then(([program, copyId]) => active && setState({ status: 'ready', program, copyId }))
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
          Fant ikke programmet. Det kan være slettet eller ikke lenger delt med deg.
        </ThemedText>
      </ThemedView>
    );
  }
  const { program: p, copyId } = state;

  const download = async () => {
    setDownloading(true);
    try {
      const copy = await downloadProgram(p.id, uuidv7());
      await refreshAfterDownload(db);
      await saveDownloadedProgram(db, copy);
      router.replace({ pathname: '/program/[id]', params: { id: copy.id } });
    } catch (e) {
      setDownloading(false);
      Alert.alert('Kunne ikke laste ned', e instanceof Error ? e.message : 'Prøv igjen når du har nett.');
    }
  };

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen
        options={{
          title: 'Program',
          headerRight: p.mine
            ? undefined
            : () => (
                <Pressable
                  onPress={() => openReport('PROGRAM', p.id, p.author.username)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Rapporter programmet">
                  <Icon name="flag" color={theme.text} fallback="⚑" />
                </Pressable>
              ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.coverWrap}>
          <ProgramCover id={p.id} title={p.name} tag={p.daysPerWeek ? `${p.daysPerWeek} DAGER/UKE` : undefined} size={220} radius={20} />
        </View>
        <ThemedText accessibilityRole="header" style={styles.title}>{p.name}</ThemedText>
        <View style={[styles.authorBox, { backgroundColor: theme.backgroundElement }]}>
          <AuthorRow author={p.author} mine={p.mine} />
        </View>
        {p.basedOn && <CreditLine credit={p.basedOn} />}

        <View style={styles.facts}>
          {p.level && <Fact icon="chart.bar" text={LEVEL_LABELS[p.level]} />}
          {p.daysPerWeek && <Fact icon="calendar" text={`${p.daysPerWeek} dager/uke`} />}
          <Fact icon="arrow.down.circle" text={downloadsLabel(p.downloadCount)} />
          {p.remixCount > 0 && (
            <Fact icon="arrow.triangle.branch" text={`${p.remixCount} ${p.remixCount === 1 ? 'versjon' : 'versjoner'} bygger på dette`} />
          )}
          {p.author.username && <Fact icon={VISIBILITY_ICONS[p.visibility]} text={VISIBILITY_LABELS[p.visibility]} />}
        </View>

        {p.mine ? (
          <Button label="Åpne i biblioteket" onPress={() => router.replace({ pathname: '/program/[id]', params: { id: p.id } })} />
        ) : copyId ? (
          <Button label="Åpne kopien i biblioteket" onPress={() => router.replace({ pathname: '/program/[id]', params: { id: copyId } })} />
        ) : (
          <Button label="Last ned til biblioteket" onPress={download} loading={downloading} />
        )}

        {p.description && <ThemedText style={styles.description}>{p.description}</ThemedText>}

        <ThemedText accessibilityRole="header" style={styles.section}>
          {p.routines.length} {p.routines.length === 1 ? 'rutine' : 'rutiner'}
        </ThemedText>
        {p.routines.map((r) => (
          <View key={r.id} style={styles.routine}>
            <ThemedText style={styles.routineName}>{r.name}</ThemedText>
            <RoutineExercises exercises={r.exercises} />
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  centerText: { textAlign: 'center' },
  authorBox: { padding: Spacing.three, borderRadius: Radius.large },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  coverWrap: { alignItems: 'center', marginBottom: Spacing.two },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 700 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  description: { fontSize: 16, lineHeight: 23 },
  section: { fontSize: 20, lineHeight: 26, fontWeight: 700, marginTop: Spacing.three },
  routine: { gap: Spacing.two },
  routineName: { fontSize: 18, fontWeight: 600 },
});
