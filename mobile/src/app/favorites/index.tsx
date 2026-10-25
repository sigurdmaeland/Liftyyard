import { Stack, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ListTile } from '@/components/list-tile';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { initials } from '@/features/programs/initials';
import { programColor } from '@/features/programs/program-colors';
import { startRoutine } from '@/features/programs/start-routine';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { listFavoriteRoutines, setRoutineFavorite } from '@/storage/program-store';
import { Radius, Spacing } from '@/theme';
import type { Routine } from '@/types/program';

/** Favoritter: rutiner du har lagret for rask tilgang. */
export default function FavoritesScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { state, reload } = useLocalQuery(listFavoriteRoutines);
  const routines = state.status === 'ready' ? state.data : [];

  const openMenu = (r: Routine) => {
    Alert.alert(r.name, undefined, [
      { text: 'Åpne rutinen', onPress: () => router.push({ pathname: '/routine/[id]', params: { id: r.id } }) },
      { text: 'Fjern fra favoritter', style: 'destructive', onPress: () => setRoutineFavorite(db, r.id, false).then(reload) },
      { text: 'Avbryt', style: 'cancel' },
    ]);
  };

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ title: '', headerTransparent: true }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={[styles.cover, { backgroundColor: theme.tile }]}>
          <Icon name="bookmark" size={72} color={theme.text} fallback="🔖" />
        </View>
        <ThemedText accessibilityRole="header" style={styles.title}>Favoritter</ThemedText>

        <ListTile icon="plus" title="Legg til rutine i favoritter" onPress={() => router.push('/favorites/add')} />
        {routines.map((r) => (
          <ListTile
            key={r.id}
            initials={initials(r.name)}
            tileColor={programColor(r.id)}
            title={r.name}
            subtitle={`${r.exercises.length} ${r.exercises.length === 1 ? 'øvelse' : 'øvelser'}`}
            onPress={() => router.push({ pathname: '/routine/[id]', params: { id: r.id } })}
            right={
              <View style={styles.actions}>
                <Pressable onPress={() => startRoutine(db, r)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Start ${r.name}`}>
                  <Icon name="play.circle" size={36} color={theme.text} fallback="▶" />
                </Pressable>
                <Pressable onPress={() => openMenu(r)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Valg for ${r.name}`}>
                  <Icon name="ellipsis" size={22} color={theme.text} fallback="⋯" />
                </Pressable>
              </View>
            }
          />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.one, paddingBottom: Spacing.six },
  cover: { width: 200, height: 200, borderRadius: Radius.large, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.four },
  title: { fontSize: 28, lineHeight: 36, fontWeight: 700, marginBottom: Spacing.three },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
});
