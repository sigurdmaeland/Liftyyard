import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ElapsedTime } from '@/components/elapsed-time';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/theme';
import type { Workout } from '@/types/workout';

export function ActiveWorkoutCard({ workout }: { workout: Workout }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="small" themeColor="textSecondary">
        Pågående økt
      </ThemedText>
      <View style={styles.row}>
        <ThemedText type="smallBold" style={styles.name} numberOfLines={1}>
          {workout.name}
        </ThemedText>
        <ElapsedTime since={workout.startedAt} style={styles.time} />
      </View>
      <Button label="Fortsett økten" onPress={() => router.push('/workout')} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  name: { flex: 1, fontSize: 18 },
  time: { fontSize: 18, fontWeight: 600 },
});
