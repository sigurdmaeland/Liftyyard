import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ExercisesTab } from '@/features/profile/exercises-tab';
import { MeasurementsTab } from '@/features/profile/measurements-tab';
import { OverviewTab } from '@/features/profile/overview-tab';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useTheme } from '@/hooks/use-theme';
import { formatVolume } from '@/lib/format';
import { computeTotals } from '@/lib/metrics';
import { weekStreak } from '@/lib/stats';
import { listExercises } from '@/storage/exercise-store';
import { listFinishedWorkoutsDetailed } from '@/storage/workout-store';
import { MaxContentWidth, Spacing } from '@/theme';

type Tab = 'overview' | 'exercises' | 'measurements';

const loadProfile = async (db: SQLiteDatabase) => ({
  workouts: await listFinishedWorkoutsDetailed(db, 5000),
  catalog: await listExercises(db),
});

/** Du: oversikt over treningen, øvelsene du har gjort og kroppsmålinger. */
export default function ProfileScreen() {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('overview');
  const { state } = useLocalQuery(loadProfile);
  const data = state.status === 'ready' ? state.data : null;

  const share = () => {
    if (!data) return;
    const volume = data.workouts.reduce((sum, w) => sum + computeTotals(w.exercises).volumeKg, 0);
    const streak = weekStreak(data.workouts);
    const message = [
      `Jeg har fullført ${data.workouts.length} ${data.workouts.length === 1 ? 'økt' : 'økter'} og løftet ${formatVolume(volume)} totalt.`,
      streak > 0 ? `Ukesrekke: ${streak} ${streak === 1 ? 'uke' : 'uker'} på rad.` : null,
    ]
      .filter(Boolean)
      .join(' ');
    Share.share({ message }).catch(() => {});
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.backgroundGrouped }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.background }}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push('/me')} accessibilityRole="button" accessibilityLabel="Din profil">
            <Avatar size={44} />
          </Pressable>
          <ThemedText accessibilityRole="header" style={styles.title}>
            Du
          </ThemedText>
          <View style={styles.actions}>
            <Pressable onPress={share} disabled={!data} hitSlop={8} accessibilityRole="button" accessibilityLabel="Del fremgangen din">
              <Icon name="square.and.arrow.up" size={22} color={theme.text} fallback="⇪" />
            </Pressable>
            <Pressable onPress={() => router.push('/calendar')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Månedskalender">
              <Icon name="calendar" size={22} color={theme.text} fallback="▦" />
            </Pressable>
            <Pressable onPress={() => router.push('/settings')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Innstillinger">
              <Icon name="gearshape" size={22} color={theme.text} fallback="⚙" />
            </Pressable>
          </View>
        </View>
        <View style={[styles.tabs, { borderBottomColor: theme.backgroundSelected }]} accessibilityRole="tablist">
          <TabButton icon="chart.bar" label="Oversikt" selected={tab === 'overview'} onPress={() => setTab('overview')} />
          <TabButton icon="dumbbell" label="Øvelser" selected={tab === 'exercises'} onPress={() => setTab('exercises')} />
          <TabButton icon="ruler" label="Målinger" selected={tab === 'measurements'} onPress={() => setTab('measurements')} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        {tab === 'measurements' ? (
          <MeasurementsTab />
        ) : !data ? (
          <ActivityIndicator style={styles.loading} />
        ) : tab === 'overview' ? (
          <OverviewTab workouts={data.workouts} catalog={data.catalog} />
        ) : (
          <ExercisesTab workouts={data.workouts} catalog={data.catalog} />
        )}
      </ScrollView>
    </View>
  );
}

function TabButton({ icon, label, selected, onPress }: { icon: SFSymbol; label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const color = selected ? theme.text : theme.textSecondary;
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected }} style={styles.tab}>
      <Icon name={icon} size={22} color={color} fallback="•" />
      <ThemedText style={[styles.tabLabel, { color, fontWeight: selected ? 700 : 500 }]}>{label}</ThemedText>
      <View style={[styles.underline, { backgroundColor: selected ? theme.text : 'transparent' }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  title: { flex: 1, fontSize: 24, lineHeight: 30, fontWeight: 700 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', borderBottomWidth: StyleSheet.hairlineWidth, marginTop: Spacing.two },
  tab: { alignItems: 'center', gap: 4, paddingTop: Spacing.one, minWidth: 90 },
  tabLabel: { fontSize: 16 },
  underline: { height: 3, width: '100%', borderRadius: 2, marginTop: Spacing.two },
  content: { padding: Spacing.four, paddingBottom: 140, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  loading: { marginTop: Spacing.five },
});
