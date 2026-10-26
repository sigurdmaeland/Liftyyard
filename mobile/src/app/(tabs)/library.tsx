import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { ListTile } from '@/components/list-tile';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { listCustomExercises, listFavoriteExercises } from '@/storage/exercise-store';
import { listAllRoutines, listFavoriteRoutines, listPrograms } from '@/storage/program-store';
import type { ShareVisibility } from '@/types/program';
import { Spacing } from '@/theme';

type Filter = 'programs' | 'routines' | 'exercises';
type Sort = 'recent' | 'alpha';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'programs', label: 'Programmer' },
  { key: 'routines', label: 'Rutiner' },
  { key: 'exercises', label: 'Øvelser' },
];

const loadLibrary = async (db: SQLiteDatabase) => ({
  programs: await listPrograms(db),
  routines: await listAllRoutines(db),
  favoriteRoutines: (await listFavoriteRoutines(db)).length,
  favoriteExercises: (await listFavoriteExercises(db)).length,
  customExercises: (await listCustomExercises(db)).length,
});

/** Tillegg i undertittelen som viser at noe er delt i community. */
const SHARED: Record<ShareVisibility, string> = { PRIVATE: '', FOLLOWERS: ' · Delt med følgere', PUBLIC: ' · Delt offentlig' };

type Item = {
  key: string;
  title: string;
  subtitle?: string;
  icon?: Parameters<typeof ListTile>[0]['icon'];
  imageUri?: string | null;
  updatedAt?: string;
  onPress: () => void;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Bibliotek (som Spotify): programmer, rutiner og øvelser du har laget eller lagret.
 * Filterknappene snevrer inn listen; «Øvelser» viser bare favoritter og egendefinerte øvelser.
 */
export default function LibraryScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<Filter | null>(null);
  const [sort, setSort] = useState<Sort>('recent');
  const [grid, setGrid] = useState(false);
  const { state } = useLocalQuery(loadLibrary);
  const data = state.status === 'ready' ? state.data : null;

  // Faste rader øverst (lag ny + favoritter), deretter innhold som sorteres.
  const fixed: Item[] = [];
  let content: Item[] = [];
  if (data) {
    if (filter === 'exercises') {
      fixed.push(
        { key: 'new-ex', title: 'Lag en egendefinert øvelse', icon: 'plus', onPress: () => router.push('/exercise/edit') },
        {
          key: 'fav-ex',
          title: 'Favorittøvelser',
          subtitle: `${plural(data.favoriteExercises, 'øvelse', 'øvelser')} i favoritter`,
          icon: 'bookmark',
          onPress: () => router.push('/exercises/favorites'),
        },
        {
          key: 'custom-ex',
          title: 'Egendefinerte øvelser',
          subtitle: plural(data.customExercises, 'egendefinert øvelse', 'egendefinerte øvelser'),
          icon: 'dumbbell',
          onPress: () => router.push('/exercises/custom'),
        },
      );
    } else {
      if (filter === 'routines') {
        fixed.push({ key: 'new-r', title: 'Lag ny rutine', icon: 'plus', onPress: () => router.push('/library/create') });
      } else {
        fixed.push({ key: 'new-p', title: 'Lag nytt program', icon: 'plus', onPress: () => router.push('/library/create') });
      }
      fixed.push({
        key: 'fav',
        title: 'Favoritter',
        subtitle: plural(data.favoriteRoutines, 'rutine', 'rutiner'),
        icon: 'bookmark',
        onPress: () => router.push('/favorites'),
      });
      if (filter !== 'routines') {
        content.push(
          ...data.programs.map((p) => ({
            key: p.id,
            title: p.name,
            subtitle: `${plural(p.routineCount, 'rutine', 'rutiner')}${SHARED[p.visibility]}`,
            icon: 'books.vertical' as const,
            imageUri: p.coverUri,
            updatedAt: p.updatedAt,
            onPress: () => router.push({ pathname: '/program/[id]', params: { id: p.id } }),
          })),
        );
      }
      const routines = filter === 'routines' ? data.routines : data.routines.filter((r) => r.programId === null);
      content.push(
        ...routines.map((r) => ({
          key: r.id,
          title: r.name,
          subtitle: `${r.programName ? `${r.programName} · ` : 'Rutine · '}${plural(r.exercises.length, 'øvelse', 'øvelser')}${r.programId ? '' : SHARED[r.visibility]}`,
          icon: 'doc.text' as const,
          updatedAt: r.updatedAt,
          onPress: () => router.push({ pathname: '/routine/[id]', params: { id: r.id } }),
        })),
      );
      content =
        sort === 'alpha'
          ? content.sort((a, b) => a.title.localeCompare(b.title, 'nb'))
          : content.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    }
  }
  const items = [...fixed, ...content];

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.push('/me')} accessibilityRole="button" accessibilityLabel="Din profil">
              <Avatar size={44} />
            </Pressable>
            <ThemedText accessibilityRole="header" style={styles.title}>
              Ditt bibliotek
            </ThemedText>
            {filter === 'exercises' && (
              <Pressable onPress={() => router.push('/exercises/library')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Søk i øvelser">
                <Icon name="magnifyingglass" size={26} color={theme.text} fallback="⌕" />
              </Pressable>
            )}
            <Pressable onPress={() => router.push('/library/create')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Lag ny">
              <Icon name="plus" size={28} color={theme.text} fallback="+" />
            </Pressable>
          </View>

          <View style={styles.chips}>
            {filter && (
              <Pressable
                onPress={() => setFilter(null)}
                accessibilityRole="button"
                accessibilityLabel="Fjern filter"
                style={[styles.clear, { backgroundColor: theme.tile }]}>
                <Icon name="xmark" size={14} color={theme.text} fallback="✕" />
              </Pressable>
            )}
            {FILTERS.filter((f) => !filter || f.key === filter).map((f) => {
              const selected = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(selected ? null : f.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  style={[styles.chip, { backgroundColor: selected ? theme.accentFill : theme.tile }]}>
                  <ThemedText style={[styles.chipLabel, { color: selected ? '#FFFFFF' : theme.text }]}>{f.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

        <View style={styles.toolbar}>
          <Pressable
            onPress={() => setSort(sort === 'recent' ? 'alpha' : 'recent')}
            accessibilityRole="button"
            accessibilityLabel={`Sortering: ${sort === 'recent' ? 'sist endret' : 'alfabetisk'}`}
            style={styles.sort}>
            <Icon name="arrow.up.arrow.down" size={18} color={theme.text} fallback="⇅" />
            <ThemedText type="smallBold" style={styles.sortLabel}>
              {sort === 'recent' ? 'Siste' : 'A–Å'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => setGrid(!grid)} hitSlop={8} accessibilityRole="button" accessibilityLabel={grid ? 'Vis som liste' : 'Vis som rutenett'}>
            <Icon name={grid ? 'list.bullet' : 'square.grid.2x2'} size={22} color={theme.text} fallback="▦" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.list, grid && styles.gridList]}>
          {items.map((item) => (
            <ListTile
              key={item.key}
              icon={item.icon}
              imageUri={item.imageUri}
              title={item.title}
              subtitle={item.subtitle}
              onPress={item.onPress}
              grid={grid}
            />
          ))}
          <View style={styles.footer} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, gap: Spacing.three },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { flex: 1, fontSize: 28, lineHeight: 34, fontWeight: 700 },
  chips: { flexDirection: 'row', gap: Spacing.two, paddingBottom: Spacing.two },
  clear: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 40, paddingHorizontal: Spacing.three, borderRadius: 17, justifyContent: 'center' },
  chipLabel: { fontSize: 16, fontWeight: 500 },
  divider: { height: StyleSheet.hairlineWidth },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortLabel: { fontSize: 16 },
  list: { paddingHorizontal: Spacing.four },
  gridList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  footer: { height: 120, width: '100%' },
});
