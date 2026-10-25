import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AllExercisesTile, CategoryTile } from '@/features/exercises/category-tile';
import { CATEGORIES } from '@/lib/categories';
import { ExploreProgramCard } from '@/features/explore/program-card';
import { ExploreRoutineCard } from '@/features/explore/routine-card';
import { authorLabel } from '@/features/explore/share';
import { PeopleSearch } from '@/features/social/people-search';
import { useTheme } from '@/hooks/use-theme';
import { fetchExplorePrograms, fetchExploreRoutines } from '@/services/explore';
import { Spacing } from '@/theme';
import type { ExploreProgram, ExploreRoutine } from '@/types/explore';

type Tab = 'programs' | 'exercises' | 'people';
type State =
  | { status: 'loading' }
  | { status: 'ready'; programs: ExploreProgram[]; routines: ExploreRoutine[] }
  | { status: 'error'; message: string };

type Section =
  | { kind: 'programs'; title: string; items: ExploreProgram[] }
  | { kind: 'routines'; title: string; items: ExploreRoutine[] };

const byNewest = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);

/** Utforsk: community-programmer og -rutiner (karuseller), hele øvelsesbiblioteket og personer. */
export default function ExploreScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'programs');
  // «Finn folk å følge» fra Hjem åpner Personer-fanen (også når Utforsk allerede er åpen).
  const [tabParam, setTabParam] = useState(params.tab);
  if (params.tab !== tabParam) {
    setTabParam(params.tab);
    if (params.tab) setTab(params.tab);
  }
  const selectTab = (t: Tab) => {
    setTab(t);
    if (params.tab) router.setParams({ tab: undefined });
  };
  const [query, setQuery] = useState('');
  const [peopleQuery, setPeopleQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([fetchExplorePrograms(), fetchExploreRoutines()])
        .then(([programs, routines]) => active && setState({ status: 'ready', programs, routines }))
        .catch((e: unknown) => active && setState({ status: 'error', message: e instanceof Error ? e.message : 'Ukjent feil' }));
      return () => {
        active = false;
      };
      // attempt er med for at «Prøv igjen» skal hente på nytt.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt]),
  );

  const sections = useMemo((): Section[] => {
    if (state.status !== 'ready') return [];
    const q = query.trim().toLowerCase();
    const matches = (name: string, text: string | null, author: string) =>
      !q || name.toLowerCase().includes(q) || (text ?? '').toLowerCase().includes(q) || author.toLowerCase().includes(q);
    const programs = state.programs.filter((p) => matches(p.name, p.description, `${authorLabel(p.author)} ${p.author.displayName}`));
    const routines = state.routines.filter((r) => matches(r.name, r.notes, `${authorLabel(r.author)} ${r.author.displayName}`));
    const list: Section[] = q
      ? [
          { kind: 'programs', title: 'Programmer', items: programs },
          { kind: 'routines', title: 'Rutiner', items: routines },
        ]
      : [
          { kind: 'programs', title: 'Fra folk du følger', items: programs.filter((p) => p.fromFollowing) },
          { kind: 'routines', title: 'Rutiner fra folk du følger', items: routines.filter((r) => r.fromFollowing) },
          { kind: 'programs', title: 'Populære programmer', items: programs },
          { kind: 'routines', title: 'Populære rutiner', items: routines },
          { kind: 'programs', title: 'For nybegynnere', items: programs.filter((p) => p.level === 'BEGINNER') },
          { kind: 'programs', title: 'Nyeste programmer', items: [...programs].sort(byNewest) },
          { kind: 'routines', title: 'Nyeste rutiner', items: [...routines].sort(byNewest) },
        ];
    return list.filter((s) => s.items.length > 0);
  }, [state, query]);

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <View style={styles.header}>
          {tab === 'people' ? (
            <View style={[styles.search, { backgroundColor: theme.tile }]}>
              <Icon name="magnifyingglass" size={18} color={theme.textSecondary} fallback="⌕" />
              <TextInput
                value={peopleQuery}
                onChangeText={setPeopleQuery}
                placeholder="Søk etter personer"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Søk etter personer"
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                returnKeyType="search"
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>
          ) : tab === 'programs' ? (
            <View style={[styles.search, { backgroundColor: theme.tile }]}>
              {(searchFocused || query !== '') && (
                <Icon name="magnifyingglass" size={18} color={theme.textSecondary} fallback="⌕" />
              )}
              <TextInput
                value={query}
                onChangeText={setQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                accessibilityLabel="Søk etter programmer og rutiner"
                autoCorrect={false}
                clearButtonMode="while-editing"
                style={[styles.searchInput, { color: theme.text }]}
              />
              {/* Sentrert plassholder (som «Søk etter øvelser») til feltet tas i bruk. */}
              {!searchFocused && query === '' && (
                <View style={styles.searchOverlay} pointerEvents="none">
                  <Icon name="magnifyingglass" size={18} color={theme.textSecondary} fallback="⌕" />
                  <ThemedText themeColor="textSecondary" style={styles.searchPlaceholder}>
                    Søk i programmer og rutiner
                  </ThemedText>
                </View>
              )}
            </View>
          ) : (
            <Pressable
              onPress={() => router.push({ pathname: '/exercises/library', params: { focus: '1' } })}
              accessibilityRole="search"
              accessibilityLabel="Søk etter øvelser"
              style={[styles.search, styles.searchCentered, { backgroundColor: theme.tile }]}>
              <Icon name="magnifyingglass" size={18} color={theme.textSecondary} fallback="⌕" />
              <ThemedText themeColor="textSecondary" style={styles.searchPlaceholder}>
                Søk etter øvelser
              </ThemedText>
            </Pressable>
          )}
          <View style={[styles.tabs, { borderBottomColor: theme.backgroundSelected }]}>
            <TabButton icon="calendar" label="Programmer" selected={tab === 'programs'} onPress={() => selectTab('programs')} />
            <TabButton icon="dumbbell" label="Øvelser" selected={tab === 'exercises'} onPress={() => selectTab('exercises')} />
            <TabButton icon="person.2" label="Personer" selected={tab === 'people'} onPress={() => selectTab('people')} />
          </View>
        </View>

        {tab === 'people' ? (
          <PeopleSearch query={peopleQuery} />
        ) : tab === 'exercises' ? (
          <ScrollView contentContainerStyle={styles.categoryContent}>
            <ThemedText accessibilityRole="header" style={styles.categoryTitle}>Muskelgrupper</ThemedText>
            <View style={styles.categoryGrid}>
              <AllExercisesTile onPress={() => router.push('/exercises/library')} />
              {CATEGORIES.map((c) => (
                <CategoryTile
                  key={c.key}
                  category={c}
                  onPress={() => router.push({ pathname: '/exercises/library', params: { category: c.key } })}
                />
              ))}
            </View>
          </ScrollView>
        ) : state.status === 'loading' ? (
          <View style={styles.content} accessible accessibilityLabel="Laster" accessibilityRole="progressbar">
            {[0, 1].map((row) => (
              <View key={row} style={styles.section} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Skeleton width={200} height={24} style={styles.skeletonTitle} />
                <View style={styles.carousel}>
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} width={160} height={200} radius={16} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : state.status === 'error' ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              Utforsk krever nett. {state.message}
            </ThemedText>
            <Button
              label="Prøv igjen"
              variant="secondary"
              onPress={() => {
                setState({ status: 'loading' });
                setAttempt((n) => n + 1);
              }}
            />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag">
            {sections.length === 0 && (
              <ThemedText themeColor="textSecondary" style={styles.noHits}>
                Ingen programmer eller rutiner passer søket.
              </ThemedText>
            )}
            {sections.map((s) => (
              <View key={s.title} style={styles.section}>
                <ThemedText accessibilityRole="header" style={styles.sectionTitle}>{s.title}</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
                  {s.kind === 'programs'
                    ? s.items.map((p) => <ExploreProgramCard key={p.id} program={p} />)
                    : s.items.map((r) => <ExploreRoutineCard key={r.id} routine={r} />)}
                </ScrollView>
              </View>
            ))}
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              Del dine egne programmer og rutiner fra Bibliotek: åpne dem og velg hvem som kan se dem.
            </ThemedText>
            <View style={styles.footer} />
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function TabButton({ icon, label, selected, onPress }: { icon: SFSymbol; label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const color = selected ? theme.text : theme.textSecondary;
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected }} style={styles.tab}>
      <Icon name={icon} size={24} color={color} fallback="•" />
      <ThemedText style={[styles.tabLabel, { color, fontWeight: selected ? 700 : 500 }]}>{label}</ThemedText>
      <View style={[styles.underline, { backgroundColor: selected ? theme.text : 'transparent' }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingTop: Spacing.two, gap: Spacing.three },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginHorizontal: Spacing.four, minHeight: 46, borderRadius: 23, paddingHorizontal: Spacing.three },
  searchInput: { flex: 1, fontSize: 17 },
  searchCentered: { justifyContent: 'center' },
  searchOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  searchPlaceholder: { fontSize: 17 },
  categoryContent: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four, paddingBottom: 120 },
  categoryTitle: { fontSize: 22, lineHeight: 28, fontWeight: 700, marginBottom: Spacing.three },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.five, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { alignItems: 'center', gap: 4, paddingTop: Spacing.one },
  tabLabel: { fontSize: 16 },
  underline: { height: 3, width: '100%', borderRadius: 2, marginTop: Spacing.two },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  centerText: { textAlign: 'center' },
  content: { paddingTop: Spacing.four, gap: Spacing.five },
  section: { gap: Spacing.three },
  sectionTitle: { fontSize: 22, lineHeight: 28, fontWeight: 700, paddingHorizontal: Spacing.four },
  carousel: { flexDirection: 'row', gap: Spacing.three, paddingHorizontal: Spacing.four },
  skeletonTitle: { marginHorizontal: Spacing.four },
  noHits: { paddingHorizontal: Spacing.four },
  note: { paddingHorizontal: Spacing.four },
  footer: { height: 100 },
});
