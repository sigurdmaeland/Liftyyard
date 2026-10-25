import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { type ComponentRef, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import { ElapsedTime } from '@/components/elapsed-time';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { defaultWorkoutName } from '@/lib/format';
import { startWorkout } from '@/storage/workout-store';
import { Spacing } from '@/theme';
import type { Workout } from '@/types/workout';

/** Høyden på den flytende fanelinjen over hjem-indikatoren (iOS 26+), målt fra Lyfta-skjermbildet. */
const TAB_BAR_HEIGHT = 50;
/** Luft mellom knappen og fanelinjen. */
const GAP = 16;

/**
 * Flytende knapp nederst til høyre: «Start ny økt», eller «Fortsett økt» når en økt pågår.
 * Knappen måler hvor skjermflaten slutter i vinduet, slik at den ligger like over fanelinjen
 * uansett om innholdet går under fanelinjen eller stopper over den.
 */
export function StartWorkoutButton({ active }: { active: Workout | null }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const probe = useRef<ComponentRef<typeof View>>(null);
  const [bottom, setBottom] = useState<number | null>(null);

  const measure = () => {
    probe.current?.measureInWindow((_x, y, _w, h) => {
      const hiddenBelow = Math.max(0, windowHeight - (y + h)); // Hvor mye av vinduet som ligger under flaten.
      const tabBarTop = (initialWindowMetrics?.insets.bottom ?? 34) + TAB_BAR_HEIGHT;
      setBottom(Math.max(GAP, tabBarTop + GAP - hiddenBelow));
    });
  };

  const onPress = async () => {
    if (!active) await startWorkout(db, defaultWorkoutName());
    router.push('/workout');
  };

  return (
    <>
      <View ref={probe} onLayout={measure} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {bottom !== null && (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={active ? 'Trening pågår, åpne økten' : 'Start ny økt'}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: theme.accentFill, bottom, transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}>
          <Icon name="play.fill" size={20} color="#FFFFFF" fallback="▶" />
          <ThemedText style={styles.label}>{active ? 'Trening pågår' : 'Start ny økt'}</ThemedText>
          {active && <ElapsedTime since={active.startedAt} style={styles.time} />}
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    height: 56,
    paddingHorizontal: Spacing.four,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  label: { color: '#FFFFFF', fontSize: 18, fontWeight: 600 },
  time: { color: '#FFFFFF', fontSize: 16, opacity: 0.85 },
});
