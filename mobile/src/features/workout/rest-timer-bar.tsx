import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { restTimer, useRestTimer } from '@/features/workout/rest-timer';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/format';
import { Radius, Spacing } from '@/theme';

/** Nedtelling nederst på skjermen mens hviletimeren går. */
export function RestTimerBar() {
  const theme = useTheme();
  const { endsAt } = useRestTimer();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) {
        restTimer.stop();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }, 250);
    return () => clearInterval(timer);
  }, [endsAt]);

  if (endsAt === null) return null;
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  return (
    <View style={[styles.bar, { backgroundColor: theme.text }]} accessibilityLiveRegion="polite">
      <SmallButton label="−15" onPress={() => restTimer.adjust(-15)} color={theme.background} />
      <View style={styles.center}>
        <ThemedText type="small" style={{ color: theme.background, opacity: 0.7 }}>
          Pause
        </ThemedText>
        <ThemedText style={[styles.time, { color: theme.background }]}>{formatDuration(remaining)}</ThemedText>
      </View>
      <SmallButton label="+15" onPress={() => restTimer.adjust(15)} color={theme.background} />
      <SmallButton label="Hopp over" onPress={() => restTimer.stop()} color={theme.background} />
    </View>
  );
}

function SmallButton({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={styles.small}>
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.five,
    borderRadius: Radius.large,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  center: { flex: 1, alignItems: 'center' },
  time: { fontSize: 22, lineHeight: 28, fontWeight: 700, fontVariant: ['tabular-nums'] },
  small: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
});
