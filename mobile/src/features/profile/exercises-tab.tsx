import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BodyFigure } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Sparkline } from '@/features/profile/sparkline';
import { useTheme } from '@/hooks/use-theme';
import { exerciseFigure } from '@/lib/categories';
import { performedExercises } from '@/lib/profile-stats';
import { formatRelativeDateTime } from '@/lib/stats';
import { Radius, Spacing } from '@/theme';
import type { Exercise, Workout } from '@/types/workout';
import { formatWeight } from '@/lib/units';

type Sort = 'recent' | 'name' | 'oneRm';
const SORT_LABELS: Record<Sort, string> = { recent: 'Nylig utført', name: 'Navn A–Å', oneRm: 'Høyest est. 1RM' };
const NEXT_SORT: Record<Sort, Sort> = { recent: 'name', name: 'oneRm', oneRm: 'recent' };

/** Øvelser brukeren har utført, med estimert 1RM og en minigraf over utviklingen. */
export function ExercisesTab({ workouts, catalog }: { workouts: Workout[]; catalog: Exercise[] }) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const byId = useMemo(() => new Map(catalog.map((e) => [e.id, e])), [catalog]);
  const all = useMemo(() => performedExercises(workouts), [workouts]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = all.filter((e) => !q || e.name.toLowerCase().includes(q));
    if (sort === 'name') return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'nb'));
    if (sort === 'oneRm') return [...filtered].sort((a, b) => (b.best1RM ?? -1) - (a.best1RM ?? -1));
    return filtered;
  }, [all, query, sort]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.search, { backgroundColor: theme.card }]}>
        <Icon name="magnifyingglass" size={18} color={theme.textSecondary} fallback="⌕" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Søk etter øvelser"
          placeholderTextColor={theme.textSecondary}
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Søk etter øvelser"
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>

      <Pressable
        onPress={() => setSort(NEXT_SORT[sort])}
        accessibilityRole="button"
        accessibilityLabel={`Sortering: ${SORT_LABELS[sort]}. Trykk for å bytte.`}
        style={styles.sort}>
        <Icon name="arrow.up.arrow.down" size={15} color={theme.text} fallback="⇅" />
        <ThemedText type="smallBold">{SORT_LABELS[sort]}</ThemedText>
      </Pressable>

      {all.length === 0 ? (
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          Øvelser du fullfører sett i dukker opp her, med estimert 1RM og utvikling.
        </ThemedText>
      ) : list.length === 0 ? (
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          Ingen treff.
        </ThemedText>
      ) : (
        <View style={[styles.list, { backgroundColor: theme.card }]}>
          {list.map((e, i) => {
            const exercise = byId.get(e.exerciseId);
            const figure = exercise ? exerciseFigure(exercise) : null;
            return (
              <Pressable
                key={e.exerciseId}
                onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.exerciseId } })}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
                  { opacity: pressed ? 0.6 : 1 },
                ]}>
                <View style={[styles.figure, { backgroundColor: theme.tile }]}>
                  {figure && <BodyFigure side={figure.side} load={figure.load} height={48} crop="upper" />}
                </View>
                <View style={styles.text}>
                  <ThemedText style={styles.name} numberOfLines={1}>
                    {e.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {e.best1RM !== null
                      ? `Est. 1RM: ${formatWeight(e.best1RM)}`
                      : `Sist: ${formatRelativeDateTime(e.lastPerformed)}`}
                  </ThemedText>
                </View>
                <Sparkline values={e.series} />
                <Icon name="chevron.right" size={14} color={theme.textSecondary} fallback="›" />
              </Pressable>
            );
          })}
        </View>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        Est. 1RM er et estimat (Epleys formel) ut fra ditt beste sett med 1–12 repetisjoner.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44, borderRadius: 22, paddingHorizontal: Spacing.three },
  searchInput: { flex: 1, fontSize: 17 },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  list: { borderRadius: Radius.large, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  figure: { width: 52, height: 52, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { flex: 1, gap: 2 },
  name: { fontWeight: 600 },
  empty: { textAlign: 'center', marginTop: Spacing.four },
  note: { textAlign: 'center' },
});
