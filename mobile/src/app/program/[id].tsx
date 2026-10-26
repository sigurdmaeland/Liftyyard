import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { showActionMenu } from '@/components/action-menu';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CreditLine } from '@/features/explore/credit-line';
import { LEVEL_LABELS, ProgramCover } from '@/features/explore/program-cover';
import { Fact } from '@/features/explore/routine-exercises';
import { startRoutine } from '@/features/programs/start-routine';
import { VISIBILITY_ICONS } from '@/features/workout/visibility-picker';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { syncPendingWorkouts } from '@/services/sync';
import { deleteProgram, duplicateProgram, getProgram } from '@/storage/program-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';
import type { Program } from '@/types/program';
import { VISIBILITY_LABELS } from '@/types/workout';

/**
 * Et program i biblioteket, slik det ser ut: forside, beskrivelse og rutinene med «Start».
 * Redigering, kopi og sletting ligger i ⋯-menyen oppe til høyre.
 */
export default function ProgramScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useCallback((db: SQLiteDatabase) => getProgram(db, id), [id]);
  const { state } = useLocalQuery(query);
  const db = useSQLiteContext();

  // Last opp endringer når brukeren forlater programmet.
  useFocusEffect(
    useCallback(
      () => () => {
        syncPendingWorkouts(db).catch(() => {});
      },
      [db],
    ),
  );

  if (state.status !== 'ready') return <ThemedView style={styles.fill} />;
  if (!state.data) {
    return (
      <ThemedView style={[styles.fill, styles.center]}>
        <ThemedText themeColor="textSecondary">Programmet finnes ikke lenger.</ThemedText>
      </ThemedView>
    );
  }
  return <ProgramView program={state.data} />;
}

function ProgramView({ program }: { program: Program }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const coverSize = Math.min(width - Spacing.four * 2, 320);
  const routineCount = program.routines.length;

  const confirmDelete = () =>
    Alert.alert('Slette programmet?', 'Alle rutinene i programmet slettes. Gjennomførte økter beholdes.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Slett',
        style: 'destructive',
        onPress: async () => {
          await deleteProgram(db, program.id);
          router.back();
        },
      },
    ]);

  const copy = async () => {
    const copyId = await duplicateProgram(db, program.id);
    if (copyId) router.replace({ pathname: '/program/[id]', params: { id: copyId } });
  };

  const openMenu = () =>
    showActionMenu(program.name, [
      { label: 'Rediger program', onPress: () => router.push({ pathname: '/program/edit', params: { id: program.id } }) },
      { label: 'Lag en kopi', onPress: copy },
      { label: 'Slett program', destructive: true, onPress: confirmDelete },
    ]);

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable onPress={openMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel="Valg for programmet">
              <Icon name="ellipsis" color={theme.text} fallback="⋯" />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.coverWrap}>
          <ProgramCover
            id={program.id}
            title={program.name}
            tag={program.daysPerWeek ? `${program.daysPerWeek} DAGER/UKE` : undefined}
            size={coverSize}
            radius={20}
            imageUri={program.coverUri}
          />
        </View>
        <ThemedText accessibilityRole="header" style={styles.title}>
          {program.name}
        </ThemedText>
        {program.basedOn ? (
          <CreditLine credit={program.basedOn} />
        ) : (
          program.sourceProgramId && (
            <ThemedText type="small" themeColor="textSecondary">
              Lastet ned fra Utforsk. Dette er din egen kopi.
            </ThemedText>
          )
        )}

        <View style={styles.facts}>
          {program.level && <Fact icon="chart.bar" text={LEVEL_LABELS[program.level]} />}
          {program.daysPerWeek && <Fact icon="calendar" text={`${program.daysPerWeek} dager/uke`} />}
          <Fact icon="list.bullet" text={`${routineCount} ${routineCount === 1 ? 'rutine' : 'rutiner'}`} />
          <Fact icon={VISIBILITY_ICONS[program.visibility]} text={VISIBILITY_LABELS[program.visibility]} />
        </View>

        {program.description && <ThemedText style={styles.description}>{program.description}</ThemedText>}

        <ThemedText accessibilityRole="header" style={styles.section}>
          Rutiner
        </ThemedText>
        {routineCount === 0 && (
          <ThemedText themeColor="textSecondary">Ingen rutiner ennå. Legg til rutiner under ⋯ → Rediger program.</ThemedText>
        )}
        {program.routines.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => router.push({ pathname: '/routine/[id]', params: { id: r.id } })}
            accessibilityRole="button"
            accessibilityHint="Åpner rutinen"
            style={({ pressed }) => [styles.routine, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 }]}>
            <View style={styles.routineText}>
              <ThemedText style={styles.routineName}>{r.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                {r.exercises.length === 0
                  ? 'Ingen øvelser ennå'
                  : r.exercises.map((e) => `${e.sets.length} × ${e.exerciseName}`).join(' · ')}
              </ThemedText>
            </View>
            {r.exercises.length > 0 && (
              <Pressable
                onPress={() => startRoutine(db, r)}
                accessibilityRole="button"
                accessibilityLabel={`Start ${r.name}`}
                style={({ pressed }) => [styles.start, { backgroundColor: theme.accentFill, opacity: pressed ? 0.8 : 1 }]}>
                <Icon name="play.fill" size={14} color="#FFFFFF" fallback="▶" />
                <ThemedText type="smallBold" style={styles.startLabel}>
                  Start
                </ThemedText>
              </Pressable>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  coverWrap: { alignItems: 'center', marginBottom: Spacing.two },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 800 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  description: { fontSize: 16, lineHeight: 23 },
  section: { fontSize: 22, lineHeight: 28, fontWeight: 700, marginTop: Spacing.three },
  routine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.large },
  routineText: { flex: 1, gap: 4 },
  routineName: { fontSize: 18, fontWeight: 600 },
  start: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.three, minHeight: 44, borderRadius: 22 },
  startLabel: { color: '#FFFFFF' },
});
