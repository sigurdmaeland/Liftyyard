import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, StyleSheet } from 'react-native';

import { ListTile } from '@/components/list-tile';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { initials } from '@/features/programs/initials';
import { programColor } from '@/features/programs/program-colors';
import { useLocalQuery } from '@/hooks/use-local-query';
import { listAllRoutines, setRoutineFavorite } from '@/storage/program-store';
import { Spacing } from '@/theme';

const loadCandidates = async (db: SQLiteDatabase) => (await listAllRoutines(db)).filter((r) => !r.favorite);

/** Velg en rutine å legge i favoritter. */
export default function AddFavoriteScreen() {
  const db = useSQLiteContext();
  const { state } = useLocalQuery(loadCandidates);
  const routines = state.status === 'ready' ? state.data : [];

  return (
    <ThemedView style={styles.fill}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        {state.status === 'ready' && routines.length === 0 && (
          <ThemedText themeColor="textSecondary">Alle rutinene dine er allerede favoritter, eller du har ingen rutiner ennå.</ThemedText>
        )}
        {routines.map((r) => (
          <ListTile
            key={r.id}
            initials={initials(r.name)}
            tileColor={programColor(r.id)}
            title={r.name}
            subtitle={r.programName ?? 'Rutine'}
            onPress={async () => {
              await setRoutineFavorite(db, r.id, true);
              router.back();
            }}
          />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: Spacing.six },
});
