import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CreditLine } from '@/features/explore/credit-line';
import { programColor } from '@/features/programs/program-colors';
import { ShareSection } from '@/features/programs/share-section';
import { startRoutine } from '@/features/programs/start-routine';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { syncPendingWorkouts } from '@/services/sync';
import { createRoutine, deleteProgram, getProgram, setProgramFacts, setProgramVisibility, updateProgramDetails } from '@/storage/program-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';
import type { Level } from '@/types/explore';
import type { Program, ShareVisibility } from '@/types/program';

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
  return <ProgramEditor key={state.data.id} program={state.data} />;
}

function ProgramEditor({ program }: { program: Program }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isNew } = useLocalSearchParams<{ isNew?: string }>();
  const [name, setName] = useState(program.name);
  const [description, setDescription] = useState(program.description ?? '');
  const [visibility, setVisibility] = useState<ShareVisibility>(program.visibility);
  const [facts, setFacts] = useState<{ level: Level | null; daysPerWeek: number | null }>({
    level: program.level,
    daysPerWeek: program.daysPerWeek,
  });

  const changeVisibility = (v: ShareVisibility) => {
    setVisibility(v);
    setProgramVisibility(db, program.id, v).catch(() => {});
  };
  const changeFacts = (level: Level | null, daysPerWeek: number | null) => {
    setFacts({ level, daysPerWeek });
    setProgramFacts(db, program.id, level, daysPerWeek).catch(() => {});
  };

  const save = (n: string, d: string) => {
    if (n.trim()) updateProgramDetails(db, program.id, n.trim(), d.trim() || null).catch(() => {});
  };

  const openMenu = () => {
    Alert.alert(program.name, undefined, [
      {
        text: 'Slett program',
        style: 'destructive',
        onPress: () =>
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
          ]),
      },
      { text: 'Avbryt', style: 'cancel' },
    ]);
  };

  const newRoutine = async () => {
    const routineId = await createRoutine(db, program.id);
    router.push({ pathname: '/routine/[id]', params: { id: routineId } });
  };

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen
        options={{
          title: 'Program',
          headerRight: () => (
            <Pressable onPress={openMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel="Valg for programmet">
              <Icon name="ellipsis" color={theme.text} fallback="⋯" />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.cover, { backgroundColor: programColor(program.id) }]}>
          <Icon name="list.bullet.rectangle.portrait" size={56} color="#FFFFFF" fallback="▤" />
        </View>
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t);
            save(t, description);
          }}
          autoFocus={isNew === '1'}
          selectTextOnFocus={isNew === '1'}
          placeholder="Navn på programmet"
          placeholderTextColor={theme.textSecondary}
          maxLength={100}
          style={[styles.name, { color: theme.text }]}
          accessibilityLabel="Navn på programmet"
        />
        <TextInput
          value={description}
          onChangeText={(t) => {
            setDescription(t);
            save(name, t);
          }}
          placeholder="Beskrivelse (valgfritt)"
          accessibilityLabel="Beskrivelse av programmet, valgfritt"
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={2000}
          style={[styles.description, { color: theme.text }]}
        />

        {program.basedOn ? (
          <CreditLine credit={program.basedOn} />
        ) : (
          program.sourceProgramId && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.source}>
              Lastet ned fra Utforsk. Dette er din egen kopi.
            </ThemedText>
          )
        )}
        <ShareSection
          kind="program"
          visibility={visibility}
          onVisibility={changeVisibility}
          facts={{ ...facts, onChange: changeFacts }}
        />

        <ThemedText accessibilityRole="header" style={styles.section}>Rutiner</ThemedText>
        {program.routines.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => router.push({ pathname: '/routine/[id]', params: { id: r.id } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.routine, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 }]}>
            <View style={styles.routineText}>
              <ThemedText style={styles.routineName}>{r.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                {r.exercises.length === 0
                  ? 'Ingen øvelser ennå'
                  : r.exercises.map((e) => `${e.sets.length} × ${e.exerciseName}`).join(' · ')}
              </ThemedText>
            </View>
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
          </Pressable>
        ))}

        <Pressable
          onPress={newRoutine}
          accessibilityRole="button"
          style={({ pressed }) => [styles.addRoutine, { borderColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}>
          <Icon name="plus" size={18} color={theme.text} fallback="+" />
          <ThemedText type="smallBold">Legg til rutine</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  cover: { width: 140, height: 140, borderRadius: Radius.large, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  name: { fontSize: 28, fontWeight: 700, textAlign: 'center', paddingVertical: 0 },
  description: { fontSize: 16, textAlign: 'center' },
  source: { textAlign: 'center' },
  section: { fontSize: 22, lineHeight: 28, fontWeight: 700, marginTop: Spacing.three },
  routine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.large },
  routineText: { flex: 1, gap: 4 },
  routineName: { fontSize: 18, fontWeight: 600 },
  start: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.three, minHeight: 44, borderRadius: 19 },
  startLabel: { color: '#FFFFFF' },
  addRoutine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 52,
    borderRadius: Radius.large,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
});
