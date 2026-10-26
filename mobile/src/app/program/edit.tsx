import { Stack, router, useLocalSearchParams } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { showActionMenu } from '@/components/action-menu';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ProgramCover } from '@/features/explore/program-cover';
import { ShareSection } from '@/features/programs/share-section';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { pickJpeg } from '@/lib/image';
import { syncPendingWorkouts } from '@/services/sync';
import {
  createRoutine,
  getProgram,
  removeProgramCover,
  setProgramCover,
  setProgramFacts,
  setProgramVisibility,
  updateProgramDetails,
} from '@/storage/program-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';
import type { Level } from '@/types/explore';
import type { Program, ShareVisibility } from '@/types/program';

/**
 * Redigering av et eget program: forsidebilde, navn, beskrivelse, deling og rutiner.
 * Alt lagres lokalt med en gang og synkes. Nås fra ⋯ → «Rediger program» og når et nytt program lages.
 */
export default function EditProgramScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useCallback((db: SQLiteDatabase) => getProgram(db, id), [id]);
  const { state, reload } = useLocalQuery(query);

  if (state.status !== 'ready') return <ThemedView style={styles.fill} />;
  if (!state.data) {
    return (
      <ThemedView style={[styles.fill, styles.center]}>
        <ThemedText themeColor="textSecondary">Programmet finnes ikke lenger.</ThemedText>
      </ThemedView>
    );
  }
  return <Editor key={state.data.id} program={state.data} reload={reload} />;
}

function Editor({ program, reload }: { program: Program; reload: () => void }) {
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

  const save = (n: string, d: string) => {
    if (n.trim()) updateProgramDetails(db, program.id, n.trim(), d.trim() || null).catch(() => {});
  };
  const changeVisibility = (v: ShareVisibility) => {
    setVisibility(v);
    setProgramVisibility(db, program.id, v).catch(() => {});
  };
  const changeFacts = (level: Level | null, daysPerWeek: number | null) => {
    setFacts({ level, daysPerWeek });
    setProgramFacts(db, program.id, level, daysPerWeek).catch(() => {});
  };

  const pickCover = async () => {
    const uri = await pickJpeg({ square: true, maxSide: 1600 });
    if (!uri) return;
    await setProgramCover(db, program.id, uri);
    reload();
  };
  const changeCover = () => {
    if (!program.coverUri) {
      pickCover();
      return;
    }
    showActionMenu('Forsidebilde', [
      { label: 'Velg nytt bilde', onPress: pickCover },
      {
        label: 'Fjern bilde',
        destructive: true,
        onPress: async () => {
          await removeProgramCover(db, program.id);
          reload();
        },
      },
    ]);
  };

  const newRoutine = async () => {
    const routineId = await createRoutine(db, program.id);
    router.push({ pathname: '/routine/[id]', params: { id: routineId } });
  };

  const done = () => {
    if (!name.trim()) {
      Alert.alert('Programmet trenger et navn');
      return;
    }
    syncPendingWorkouts(db).catch(() => {});
    if (isNew === '1') router.replace({ pathname: '/program/[id]', params: { id: program.id } });
    else router.back();
  };

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen
        options={{
          title: isNew === '1' ? 'Nytt program' : 'Rediger program',
          headerRight: () => (
            <Pressable onPress={done} hitSlop={12} accessibilityRole="button" style={styles.done}>
              <ThemedText type="smallBold" style={{ color: theme.accent, fontSize: 17 }}>
                Ferdig
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={changeCover}
            accessibilityRole="button"
            accessibilityLabel={program.coverUri ? 'Endre forsidebilde' : 'Legg til forsidebilde'}
            style={({ pressed }) => [styles.coverWrap, { opacity: pressed ? 0.85 : 1 }]}>
            <ProgramCover id={program.id} title={name || 'Program'} size={160} radius={20} imageUri={program.coverUri} />
            <View style={[styles.coverBadge, { backgroundColor: theme.text, borderColor: theme.background }]}>
              <Icon name="camera.fill" size={16} color={theme.background} fallback="📷" />
            </View>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary" style={styles.coverHint}>
            {program.coverUri ? 'Trykk på bildet for å bytte eller fjerne det' : 'Trykk for å legge til et forsidebilde'}
          </ThemedText>

          <View style={styles.field}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Navn
            </ThemedText>
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
              accessibilityLabel="Navn på programmet"
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </View>
          <View style={styles.field}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Beskrivelse
            </ThemedText>
            <TextInput
              value={description}
              onChangeText={(t) => {
                setDescription(t);
                save(name, t);
              }}
              placeholder="Hva er målet med programmet? (valgfritt)"
              accessibilityLabel="Beskrivelse av programmet, valgfritt"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={2000}
              style={[styles.input, styles.multiline, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </View>

          <ShareSection kind="program" visibility={visibility} onVisibility={changeVisibility} facts={{ ...facts, onChange: changeFacts }} />

          <ThemedText accessibilityRole="header" style={styles.section}>
            Rutiner
          </ThemedText>
          {program.routines.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push({ pathname: '/routine/[id]', params: { id: r.id } })}
              accessibilityRole="button"
              accessibilityHint="Åpner rutinen for redigering"
              style={({ pressed }) => [styles.routine, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 }]}>
              <View style={styles.routineText}>
                <ThemedText style={styles.routineName}>{r.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {r.exercises.length === 1 ? '1 øvelse' : `${r.exercises.length} øvelser`}
                </ThemedText>
              </View>
              <Icon name="chevron.right" size={14} color={theme.textSecondary} fallback="›" />
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
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  done: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.one },
  coverWrap: { alignSelf: 'center' },
  coverBadge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverHint: { textAlign: 'center' },
  field: { gap: Spacing.one },
  input: { fontSize: 17, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: 12 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  section: { fontSize: 22, lineHeight: 28, fontWeight: 700, marginTop: Spacing.three },
  routine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.large },
  routineText: { flex: 1, gap: 2 },
  routineName: { fontSize: 17, fontWeight: 600 },
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
