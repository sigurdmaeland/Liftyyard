import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ExploreProgramCard } from '@/features/explore/program-card';
import { ExploreRoutineCard } from '@/features/explore/routine-card';
import { fetchUserPrograms, fetchUserRoutines } from '@/services/explore';
import { Spacing } from '@/theme';
import type { ExploreProgram, ExploreRoutine } from '@/types/explore';

/**
 * Programmer og rutiner en bruker har delt, på profilen. Viser bare det du har lov til å se
 * (offentlig, eller for følgere når du følger). Skjules helt når det ikke er noe.
 */
export function SharedLibrary({ username, version, isSelf }: { username: string; version: number; isSelf: boolean }) {
  const [data, setData] = useState<{ programs: ExploreProgram[]; routines: ExploreRoutine[] } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchUserPrograms(username), fetchUserRoutines(username)])
      .then(([programs, routines]) => active && setData({ programs, routines }))
      .catch(() => active && setData(null));
    return () => {
      active = false;
    };
  }, [username, version]);

  if (!data || (data.programs.length === 0 && data.routines.length === 0)) {
    if (isSelf && data) {
      return (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          Du har ikke delt noen programmer eller rutiner ennå. Åpne et program i Bibliotek og velg hvem som kan se det.
        </ThemedText>
      );
    }
    return null;
  }
  return (
    <View style={styles.wrap}>
      {data.programs.length > 0 && (
        <>
          <ThemedText accessibilityRole="header" style={styles.title}>Programmer</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
            {data.programs.map((p) => (
              <ExploreProgramCard key={p.id} program={p} />
            ))}
          </ScrollView>
        </>
      )}
      {data.routines.length > 0 && (
        <>
          <ThemedText accessibilityRole="header" style={styles.title}>Rutiner</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
            {data.routines.map((r) => (
              <ExploreRoutineCard key={r.id} routine={r} />
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: Spacing.two, marginTop: Spacing.three },
  title: { fontSize: 20, fontWeight: 700, paddingHorizontal: Spacing.four },
  carousel: { gap: Spacing.three, paddingHorizontal: Spacing.four },
  empty: { alignSelf: 'stretch', marginTop: Spacing.three, paddingHorizontal: Spacing.four },
});
