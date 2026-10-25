import { useEffect } from 'react';
import { type DimensionValue, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/theme';

/**
 * Grå plassholder som viser formen på innholdet mens det lastes. Pulserer rolig, men står stille
 * når «Reduser bevegelse» er på. Skjules for skjermlesere (en samlet «Laster»-etikett brukes i stedet).
 */
export function Skeleton({ width = '100%', height = 16, radius = 6, style }: { width?: DimensionValue; height?: number; radius?: number; style?: ViewStyle }) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!reduce) opacity.value = withRepeat(withTiming(0.45, { duration: 800 }), -1, true);
  }, [reduce, opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: theme.backgroundSelected }, animated, style]} />;
}

/** Plassholder med samme form som et kort i feeden. */
export function FeedCardSkeleton() {
  return (
    <View style={styles.card} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={styles.row}>
        <Skeleton width={48} height={48} radius={24} />
        <View style={styles.flex}>
          <Skeleton width="45%" height={16} />
          <Skeleton width="30%" height={12} />
        </View>
      </View>
      <Skeleton width="70%" height={26} />
      <View style={styles.row}>
        <Skeleton width={70} height={34} />
        <Skeleton width={70} height={34} />
      </View>
      <Skeleton height={180} radius={Radius.medium} />
    </View>
  );
}

/** Flere kortplassholdere, med én etikett for skjermlesere. */
export function FeedSkeleton({ count = 2 }: { count?: number }) {
  return (
    <View accessible accessibilityLabel="Laster" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <FeedCardSkeleton key={i} />
      ))}
    </View>
  );
}

/** Plassholder for lister (brukere, varsler). */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View style={styles.list} accessible accessibilityLabel="Laster" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Skeleton width={44} height={44} radius={22} />
          <View style={styles.flex}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="35%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: Spacing.four, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1, gap: Spacing.two },
  list: { gap: Spacing.three, paddingVertical: Spacing.three },
});
