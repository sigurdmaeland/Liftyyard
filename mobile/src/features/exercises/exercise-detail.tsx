import { Stack, router } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { BodyMap, MUSCLE_PRIMARY, MUSCLE_SECONDARY, type MuscleLoad } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { LineChart } from '@/components/line-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ExerciseCard } from '@/features/exercises/exercise-card';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { bestOneRepMaxPerWorkout, exerciseRecords, heaviestPerWorkout, volumePerWorkout, alternatives as findAlternatives } from '@/lib/exercise-stats';
import { formatNumber } from '@/lib/format';
import { EQUIPMENT_LABELS, EXERCISE_TYPE_LABELS, MUSCLE_LABELS } from '@/lib/labels';
import { describeSet, setLabels } from '@/lib/set-fields';
import { formatRelativeDateTime } from '@/lib/stats';
import { deleteCustomExercise, getExercise, listExercises, setExerciseFavorite } from '@/storage/exercise-store';
import { getExerciseHistory } from '@/storage/workout-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';
import type { Exercise } from '@/types/workout';
import { formatWeight, toDisplay, unitLabel } from '@/lib/units';
import { Segmented } from '@/features/profile/section-card';

type Tab = 'about' | 'history' | 'progress' | 'records';
const TABS: { key: Tab; label: string }[] = [
  { key: 'about', label: 'Om' },
  { key: 'history', label: 'Historikk' },
  { key: 'progress', label: 'Fremgang' },
  { key: 'records', label: 'Rekorder' },
];

type Props = {
  id: string;
  /** Hvordan en alternativ øvelse åpnes (inne i en økt brukes en egen rute). */
  onOpenExercise?: (exerciseId: string) => void;
};

/** Øvelsesdetaljer med fanene Om, Historikk, Fremgang og Rekorder. */
export function ExerciseDetail({ id, onOpenExercise }: Props) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('about');
  const query = useCallback(
    async (d: SQLiteDatabase) => ({
      exercise: await getExercise(d, id),
      history: await getExerciseHistory(d, id),
      catalog: await listExercises(d),
    }),
    [id],
  );
  const { state, reload } = useLocalQuery(query);

  if (state.status !== 'ready') return <ThemedView style={styles.fill} />;
  const { exercise, history, catalog } = state.data;
  if (!exercise) {
    return (
      <ThemedView style={[styles.fill, styles.center]}>
        <ThemedText themeColor="textSecondary">Fant ikke øvelsen.</ThemedText>
      </ThemedView>
    );
  }

  const open = onOpenExercise ?? ((exerciseId: string) => router.push({ pathname: '/exercise/[id]', params: { id: exerciseId } }));
  const toggleFavorite = (e: Exercise) => setExerciseFavorite(db, e.id, !e.favorite).then(reload);

  const openMenu = () => {
    const options: Parameters<typeof Alert.alert>[2] = [];
    if (exercise.custom) {
      options.push(
        { text: 'Rediger', onPress: () => router.push({ pathname: '/exercise/edit', params: { id: exercise.id } }) },
        {
          text: 'Slett øvelsen',
          style: 'destructive',
          onPress: async () => {
            await deleteCustomExercise(db, exercise.id);
            router.back();
          },
        },
      );
    }
    options.push({ text: 'Del', onPress: () => Share.share({ message: exercise.name }) }, { text: 'Avbryt', style: 'cancel' });
    Alert.alert(exercise.name, undefined, options);
  };

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen
        options={{
          title: exercise.name,
          headerRight: () => (
            <Pressable onPress={openMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel="Valg for øvelsen">
              <Icon name="ellipsis" color={theme.text} fallback="⋯" />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" stickyHeaderIndices={[0]} contentContainerStyle={styles.scroll}>
        <View style={[styles.tabs, { backgroundColor: theme.background, borderBottomColor: theme.backgroundSelected }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsInner}>
            {TABS.map((t) => {
              const selected = tab === t.key;
              return (
                <Pressable key={t.key} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityState={{ selected }} style={styles.tab}>
                  <ThemedText style={[styles.tabLabel, { color: selected ? theme.text : theme.textSecondary, fontWeight: selected ? 700 : 500 }]}>
                    {t.label}
                  </ThemedText>
                  <View style={[styles.underline, { backgroundColor: selected ? theme.text : 'transparent' }]} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.content}>
          {tab === 'about' && (
            <About
              exercise={exercise}
              alternatives={findAlternatives(exercise, catalog)}
              onToggleFavorite={toggleFavorite}
              onOpen={open}
            />
          )}
          {tab === 'history' && <History exercise={exercise} history={history} />}
          {tab === 'progress' && <Progress history={history} />}
          {tab === 'records' && <Records history={history} />}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function About({
  exercise,
  alternatives,
  onToggleFavorite,
  onOpen,
}: {
  exercise: Exercise;
  alternatives: Exercise[];
  onToggleFavorite: (e: Exercise) => void;
  onOpen: (id: string) => void;
}) {
  const load: MuscleLoad = new Map();
  exercise.secondaryMuscles.forEach((m) => load.set(m, 'SECONDARY'));
  exercise.primaryMuscles.forEach((m) => load.set(m, 'PRIMARY'));

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          icon={exercise.favorite ? 'bookmark.fill' : 'bookmark'}
          label={exercise.favorite ? 'Favoritt' : 'Favoritter'}
          onPress={() => onToggleFavorite(exercise)}
        />
        <Chip
          icon="play.rectangle.fill"
          label="YouTube"
          onPress={() => Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.name} exercise form`)}`)}
        />
        <Chip icon="square.and.arrow.up" label="Del" onPress={() => Share.share({ message: exercise.name })} />
      </ScrollView>

      <ThemedText accessibilityRole="header" style={styles.section}>Muskler som trenes</ThemedText>
      <View style={styles.bodyMap}>
        <BodyMap load={load} height={260} />
      </View>
      <MuscleList color={MUSCLE_PRIMARY} title="Primære muskler" muscles={exercise.primaryMuscles} />
      {exercise.secondaryMuscles.length > 0 && <MuscleList color={MUSCLE_SECONDARY} title="Sekundære muskler" muscles={exercise.secondaryMuscles} />}

      <ThemedText accessibilityRole="header" style={styles.section}>Detaljer</ThemedText>
      <Detail label="Utstyr" value={EQUIPMENT_LABELS[exercise.equipment] ?? exercise.equipment} />
      <Detail label="Treningstype" value={EXERCISE_TYPE_LABELS[exercise.exerciseType]} />
      {exercise.instructions ? (
        <>
          <ThemedText accessibilityRole="header" style={styles.section}>Instruksjoner</ThemedText>
          <ThemedText>{exercise.instructions}</ThemedText>
        </>
      ) : (
        !exercise.custom && (
          <ThemedText type="small" themeColor="textSecondary">
            Instruksjoner og video kommer når vi har lisensiert eller laget eget innhold.
          </ThemedText>
        )
      )}

      {alternatives.length > 0 && (
        <>
          <ThemedText accessibilityRole="header" style={styles.section}>Alternative øvelser</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel} style={styles.carouselWrap}>
            {alternatives.map((a) => (
              <ExerciseCard
                key={a.id}
                exercise={a}
                layout="grid"
                width={170}
                onPress={() => onOpen(a.id)}
                onInfo={() => onOpen(a.id)}
                onToggleFavorite={() => onToggleFavorite(a)}
              />
            ))}
          </ScrollView>
        </>
      )}
    </>
  );
}

function History({ exercise, history }: { exercise: Exercise; history: Awaited<ReturnType<typeof getExerciseHistory>> }) {
  const theme = useTheme();
  if (history.length === 0) return <Empty text="Du har ikke logget denne øvelsen ennå." />;
  return (
    <>
      {history.map((h) => {
        const labels = setLabels(h.sets);
        return (
          <Pressable
            key={h.workoutId}
            onPress={() => router.push({ pathname: '/history/[id]', params: { id: h.workoutId } })}
            accessibilityRole="button"
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.cardTitle}>{h.workoutName}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatRelativeDateTime(h.startedAt)}
            </ThemedText>
            {h.sets.map((s, i) => (
              <View key={s.id} style={styles.setRow}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.setLabel}>
                  {labels[i]}
                </ThemedText>
                <ThemedText style={styles.tabular}>{describeSet(exercise.exerciseType, s, (n) => formatNumber(n))}</ThemedText>
              </View>
            ))}
          </Pressable>
        );
      })}
    </>
  );
}

type Metric = 'heaviest' | 'e1rm' | 'volume';
const METRICS: { value: Metric; label: string; title: string }[] = [
  { value: 'heaviest', label: 'Tyngste', title: 'Tyngste sett per økt' },
  { value: 'e1rm', label: 'Est. 1RM', title: 'Beste estimerte 1RM per økt' },
  { value: 'volume', label: 'Volum', title: 'Volum per økt' },
];

function Progress({ history }: { history: Awaited<ReturnType<typeof getExerciseHistory>> }) {
  const [metric, setMetric] = useState<Metric>('heaviest');
  const raw = metric === 'heaviest' ? heaviestPerWorkout(history) : metric === 'e1rm' ? bestOneRepMaxPerWorkout(history) : volumePerWorkout(history);
  if (heaviestPerWorkout(history).length === 0) return <Empty text="Fremgang vises når du har logget øvelsen med vekt." />;
  const points = raw.map((p) => ({ ...p, value: toDisplay(p.value) }));
  const first = points[0]?.value ?? 0;
  const last = points[points.length - 1]?.value ?? 0;
  const change = points.length > 1 && first > 0 ? Math.round(((last - first) / first) * 100) : null;
  return (
    <>
      <Segmented options={METRICS.map((m) => ({ value: m.value, label: m.label }))} value={metric} onChange={setMetric} />
      <ThemedText accessibilityRole="header" style={styles.section}>
        {METRICS.find((m) => m.value === metric)!.title} ({unitLabel()})
      </ThemedText>
      {change !== null && (
        <ThemedText type="small" themeColor="textSecondary">
          {change >= 0 ? `Opp ${change} %` : `Ned ${Math.abs(change)} %`} siden første gang
        </ThemedText>
      )}
      <LineChart
        points={points}
        format={(v) => `${formatNumber(v, metric === 'volume' ? 0 : 1)} ${unitLabel()}`}
        formatDate={(iso) => new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
        area
      />
      {points.length === 1 && (
        <ThemedText type="small" themeColor="textSecondary">
          Logg øvelsen flere ganger for å se utviklingen.
        </ThemedText>
      )}
    </>
  );
}

function Records({ history }: { history: Awaited<ReturnType<typeof getExerciseHistory>> }) {
  const r = exerciseRecords(history);
  if (!r.heaviest && !r.mostReps) return <Empty text="Rekorder vises når du har fullført arbeidssett i øvelsen." />;
  const date = (iso: string) => new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <>
      {r.heaviest && <RecordCard icon="scalemass" title="Tyngste vekt" value={formatWeight(r.heaviest.value)} detail={`${r.heaviest.reps ?? '–'} reps · ${date(r.heaviest.date)}`} />}
      {r.bestSetVolume && (
        <RecordCard
          icon="square.stack.3d.up"
          title="Beste sett (volum)"
          value={`${formatWeight(r.bestSetVolume.weightKg ?? 0)} × ${r.bestSetVolume.reps}`}
          detail={`${formatWeight(r.bestSetVolume.value, 0)} · ${date(r.bestSetVolume.date)}`}
        />
      )}
      {r.mostReps && <RecordCard icon="repeat" title="Flest reps i ett sett" value={`${r.mostReps.value} reps`} detail={date(r.mostReps.date)} />}
      {r.estimated1RM && (
        <RecordCard
          icon="chart.line.uptrend.xyaxis"
          title="Estimert 1RM"
          value={`≈ ${formatWeight(Math.round(r.estimated1RM.value * 2) / 2)}`}
          detail={`Estimat (Epley) fra ${formatWeight(r.estimated1RM.weightKg ?? 0)} × ${r.estimated1RM.reps} · ikke et målt løft`}
        />
      )}
    </>
  );
}

function Chip({ icon, label, onPress }: { icon: SFSymbol; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.chip, { backgroundColor: theme.tile, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={icon} size={18} color={theme.text} fallback="•" />
      <ThemedText style={styles.chipLabel}>{label}</ThemedText>
    </Pressable>
  );
}

function MuscleList({ color, title, muscles }: { color: string; title: string; muscles: string[] }) {
  return (
    <View style={styles.muscleList}>
      <View style={styles.muscleHeader}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <ThemedText style={styles.muscleTitle}>{title}</ThemedText>
      </View>
      <ThemedText themeColor="textSecondary">{muscles.map((m) => MUSCLE_LABELS[m] ?? m).join(', ')}</ThemedText>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.detail, { borderBottomColor: theme.backgroundSelected }]}>
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
      <ThemedText>{value}</ThemedText>
    </View>
  );
}

function RecordCard({ icon, title, value, detail }: { icon: SFSymbol; title: string; value: string; detail: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, styles.recordCard, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.recordIcon, { backgroundColor: theme.tile }]}>
        <Icon name={icon} size={22} color={theme.text} fallback="★" />
      </View>
      <View style={styles.recordText}>
        <ThemedText type="small" themeColor="textSecondary">
          {title}
        </ThemedText>
        <ThemedText style={styles.recordValue}>{value}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      </View>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <ThemedText themeColor="textSecondary" style={styles.empty}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: Spacing.six },
  tabs: { borderBottomWidth: StyleSheet.hairlineWidth },
  tabsInner: { paddingHorizontal: Spacing.four, gap: Spacing.five },
  tab: { paddingTop: Spacing.two, alignItems: 'center' },
  tabLabel: { fontSize: 17 },
  underline: { height: 3, width: 28, borderRadius: 2, marginTop: Spacing.two },
  content: { padding: Spacing.four, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  chips: { gap: Spacing.two },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.three, minHeight: 40, borderRadius: 20 },
  chipLabel: { fontSize: 16, fontWeight: 500 },
  section: { fontSize: 20, lineHeight: 26, fontWeight: 700, marginTop: Spacing.three },
  bodyMap: { alignItems: 'center' },
  muscleList: { gap: 4 },
  muscleHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 12, height: 12, borderRadius: 6 },
  muscleTitle: { fontSize: 17, fontWeight: 600 },
  detail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  carouselWrap: { marginHorizontal: -Spacing.four },
  carousel: { gap: Spacing.three, paddingHorizontal: Spacing.four },
  card: { padding: Spacing.three, borderRadius: Radius.large, gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: 600 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  setLabel: { width: 20, textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  recordCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  recordIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  recordText: { flex: 1, gap: 2 },
  recordValue: { fontSize: 22, lineHeight: 28, fontWeight: 700, fontVariant: ['tabular-nums'] },
  empty: { paddingVertical: Spacing.four },
});
