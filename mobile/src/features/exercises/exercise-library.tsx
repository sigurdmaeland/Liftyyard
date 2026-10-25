import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { type ReactNode, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { BodyFigure } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CategoryFigure } from '@/features/exercises/category-tile';
import { ExerciseCard } from '@/features/exercises/exercise-card';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORIES, CATEGORY_BY_KEY, inCategory } from '@/lib/categories';
import { EQUIPMENT_LABELS } from '@/lib/labels';
import { refreshExerciseCatalog } from '@/services/sync';
import { listExercises, setExerciseFavorite } from '@/storage/exercise-store';
import { Radius, Spacing } from '@/theme';
import type { Exercise } from '@/types/workout';

type Props = {
  /** Hva som skjer når man trykker på en øvelse (åpne detaljer, eller velge den i en økt/rutine). */
  onSelect: (exercise: Exercise) => void;
  initialCategory?: string;
  autoFocusSearch?: boolean;
  /** Knapp foran søkefeltet, f.eks. tilbake-pil. */
  leading?: ReactNode;
};

const FAVORITES = 'FAVORITES';

/**
 * Øvelsesbiblioteket: søk, utstyrsfilter, kategoristripe (favoritter + muskelgrupper) og
 * øvelser som kort eller liste. Søker i den lokale kopien av katalogen, så det fungerer offline.
 */
export function ExerciseLibrary({ onSelect, initialCategory, autoFocusSearch, leading }: Props) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { state, reload } = useLocalQuery(listExercises);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(initialCategory ?? null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [refreshing, setRefreshing] = useState(false);

  const all = useMemo(() => (state.status === 'ready' ? state.data : []), [state]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (e) =>
        (q === '' || e.name.toLowerCase().includes(q)) &&
        (equipment === null || e.equipment === equipment) &&
        (category === null ||
          (category === FAVORITES ? e.favorite === true : inCategory(e, CATEGORY_BY_KEY[category]))),
    );
  }, [all, query, category, equipment]);

  const title = category === FAVORITES ? 'Favoritter' : category ? CATEGORY_BY_KEY[category].label : 'Alle øvelser';

  const toggleFavorite = async (e: Exercise) => {
    await setExerciseFavorite(db, e.id, !e.favorite);
    reload();
  };

  const retry = async () => {
    setRefreshing(true);
    await refreshExerciseCatalog(db);
    setRefreshing(false);
    reload();
  };

  const header = (
    <View style={styles.header}>
      {showFilter && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {Object.entries(EQUIPMENT_LABELS).map(([key, label]) => {
            const selected = equipment === key;
            return (
              <Pressable
                key={key}
                onPress={() => setEquipment(selected ? null : key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.chip, { backgroundColor: selected ? theme.accentFill : theme.tile }]}>
                <ThemedText type="small" style={{ color: selected ? '#FFFFFF' : theme.text }}>
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        <StripItem label="Favoritter" selected={category === FAVORITES} onPress={() => setCategory(category === FAVORITES ? null : FAVORITES)}>
          <Icon name={category === FAVORITES ? 'bookmark.fill' : 'bookmark'} size={26} color={theme.text} fallback="🔖" />
        </StripItem>
        <StripItem label="Alle øvelser" selected={category === null} onPress={() => setCategory(null)}>
          <BodyFigure side="front" load={new Map()} height={56} />
        </StripItem>
        {CATEGORIES.map((c) => (
          <StripItem key={c.key} label={c.label} selected={category === c.key} onPress={() => setCategory(category === c.key ? null : c.key)}>
            <CategoryFigure category={c} height={52} />
          </StripItem>
        ))}
      </ScrollView>

      <View style={styles.titleRow}>
        <ThemedText accessibilityRole="header" style={styles.title}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
          {results.length}
        </ThemedText>
        <Pressable
          onPress={() => setLayout(layout === 'grid' ? 'list' : 'grid')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={layout === 'grid' ? 'Vis som liste' : 'Vis som rutenett'}>
          <Icon name={layout === 'grid' ? 'list.bullet' : 'square.grid.2x2'} size={22} color={theme.text} fallback="≡" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.fill}>
      <View style={styles.searchRow}>
        {leading}
        <View style={[styles.search, { backgroundColor: theme.tile }]}>
          <Icon name="magnifyingglass" size={17} color={theme.textSecondary} fallback="⌕" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Søk etter øvelser"
            accessibilityLabel="Søk etter øvelser"
            placeholderTextColor={theme.textSecondary}
            autoFocus={autoFocusSearch}
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
        <Pressable
          onPress={() => setShowFilter(!showFilter)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Filtrer på utstyr"
          style={[styles.filter, { borderColor: equipment ? theme.accent : theme.text }]}>
          <Icon name="line.3.horizontal.decrease" size={18} color={equipment ? theme.accent : theme.text} fallback="≡" />
        </Pressable>
      </View>

      {state.status === 'ready' && all.length === 0 ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            Øvelsesbiblioteket er ikke lastet ned ennå. Koble til nettet og prøv igjen.
          </ThemedText>
          <Button label="Prøv igjen" variant="secondary" onPress={retry} loading={refreshing} />
        </View>
      ) : (
        <FlatList
          key={layout}
          contentInsetAdjustmentBehavior="automatic"
          data={results}
          keyExtractor={(e) => e.id}
          numColumns={layout === 'grid' ? 2 : 1}
          columnWrapperStyle={layout === 'grid' ? styles.columns : undefined}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            state.status === 'ready' ? (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                {category === FAVORITES ? 'Ingen favoritter ennå. Trykk på bokmerket på en øvelse.' : 'Ingen treff.'}
              </ThemedText>
            ) : undefined
          }
          renderItem={({ item }) => (
            <ExerciseCard
              exercise={item}
              layout={layout}
              onPress={() => onSelect(item)}
              onInfo={() => router.push({ pathname: '/exercise/[id]', params: { id: item.id } })}
              onToggleFavorite={() => toggleFavorite(item)}
            />
          )}
        />
      )}
    </ThemedView>
  );
}

function StripItem({ label, selected, onPress, children }: { label: string; selected: boolean; onPress: () => void; children: ReactNode }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={styles.stripItem}>
      <View style={[styles.stripBox, { backgroundColor: theme.tile, borderColor: selected ? theme.text : 'transparent' }]}>{children}</View>
      <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'} numberOfLines={1} style={styles.stripLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44, borderRadius: 22, paddingHorizontal: Spacing.three },
  searchInput: { flex: 1, fontSize: 17 },
  filter: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  header: { gap: Spacing.three, paddingBottom: Spacing.two },
  chips: { gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
  strip: { gap: Spacing.two, paddingVertical: Spacing.one },
  stripItem: { alignItems: 'center', gap: 4, width: 70 },
  stripBox: { width: 66, height: 66, borderRadius: Radius.medium, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stripLabel: { fontSize: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  title: { fontSize: 18, fontWeight: 600 },
  count: { flex: 1 },
  list: { paddingHorizontal: Spacing.three, paddingBottom: 120 },
  columns: { justifyContent: 'space-between' },
  empty: { paddingVertical: Spacing.four },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  centerText: { textAlign: 'center' },
});
