import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CreditLine } from '@/features/explore/credit-line';
import { RoutineExerciseEditor } from '@/features/programs/routine-exercise-editor';
import { ShareSection } from '@/features/programs/share-section';
import { startRoutine } from '@/features/programs/start-routine';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { syncPendingWorkouts } from '@/services/sync';
import { deleteRoutine, duplicateRoutine, getRoutine, renameRoutine, setRoutineFavorite, setRoutineVisibility } from '@/storage/program-store';
import { MaxContentWidth, Spacing } from '@/theme';
import type { Routine, ShareVisibility } from '@/types/program';

export default function RoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const query = useCallback((d: SQLiteDatabase) => getRoutine(d, id), [id]);
  const { state, reload } = useLocalQuery(query);

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
        <ThemedText themeColor="textSecondary">Rutinen finnes ikke lenger.</ThemedText>
      </ThemedView>
    );
  }
  return <RoutineEditor key={state.data.id} routine={state.data} reload={reload} />;
}

function RoutineEditor({ routine, reload }: { routine: Routine; reload: () => void }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(routine.name);
  const [visibility, setVisibility] = useState<ShareVisibility>(routine.visibility);
  const changeVisibility = (v: ShareVisibility) => {
    setVisibility(v);
    setRoutineVisibility(db, routine.id, v).catch(() => {});
  };

  const openMenu = () => {
    Alert.alert(routine.name, undefined, [
      {
        text: routine.favorite ? 'Fjern fra favoritter' : 'Legg til i favoritter',
        onPress: () => setRoutineFavorite(db, routine.id, !routine.favorite).then(reload),
      },
      {
        text: 'Dupliser rutine',
        onPress: async () => {
          const copy = await duplicateRoutine(db, routine.id);
          if (copy) router.replace({ pathname: '/routine/[id]', params: { id: copy } });
        },
      },
      {
        text: 'Slett rutine',
        style: 'destructive',
        onPress: async () => {
          await deleteRoutine(db, routine.id);
          router.back();
        },
      },
      { text: 'Avbryt', style: 'cancel' },
    ]);
  };

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen
        options={{
          title: routine.programName ?? 'Rutine',
          headerRight: () => (
            <Pressable onPress={openMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel="Valg for rutinen">
              <Icon name="ellipsis" color={theme.text} fallback="⋯" />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (t.trim()) renameRoutine(db, routine.id, t.trim()).catch(() => {});
            }}
            placeholder="Navn på rutinen"
            placeholderTextColor={theme.textSecondary}
            maxLength={100}
            style={[styles.name, { color: theme.text }]}
            accessibilityLabel="Navn på rutinen"
          />
          <ThemedText type="small" themeColor="textSecondary">
            Sett målene for hvert sett. Trykk på settnummeret for å bytte type, hold for å slette.
          </ThemedText>

          {routine.exercises.map((e, i) => (
            <RoutineExerciseEditor
              key={e.id}
              routineId={routine.id}
              exercise={e}
              isFirst={i === 0}
              isLast={i === routine.exercises.length - 1}
              onChanged={reload}
            />
          ))}

          <Pressable
            onPress={() => router.push({ pathname: '/routine/add-exercise', params: { routineId: routine.id } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addExercise, { backgroundColor: theme.text, opacity: pressed ? 0.85 : 1 }]}>
            <ThemedText type="smallBold" style={{ color: theme.background, fontSize: 17 }}>
              Legg til øvelser
            </ThemedText>
          </Pressable>

          {routine.programId === null ? (
            <ShareSection kind="rutine" visibility={visibility} onVisibility={changeVisibility} />
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Rutinen deles sammen med programmet «{routine.programName}». Velg deling på programmet.
            </ThemedText>
          )}
          {routine.basedOn && <CreditLine credit={routine.basedOn} />}
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.two, backgroundColor: theme.background }]}>
        <Button label="Start rutinen" onPress={() => startRoutine(db, routine)} disabled={routine.exercises.length === 0} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  name: { fontSize: 28, fontWeight: 700, paddingVertical: 0 },
  addExercise: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  bottom: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
});
