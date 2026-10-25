import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { Pop } from '@/components/pop';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { likeWorkout, unlikeWorkout } from '@/services/feed';
import { Spacing } from '@/theme';

/**
 * Tommel opp. Oppdaterer visningen med en gang og ruller tilbake hvis serveren ikke svarer.
 * `onChange` får ny tilstand (liked, antall).
 */
export function LikeButton({
  workoutId,
  liked,
  count,
  onChange,
  hideCount = false,
  size = 24,
}: {
  workoutId: string;
  liked: boolean;
  count: number;
  onChange: (liked: boolean, count: number) => void;
  /** Skjul tallet (når antallet står et annet sted, som i feeden). */
  hideCount?: boolean;
  size?: number;
}) {
  const theme = useTheme();
  const toggle = () => {
    const next = !liked;
    onChange(next, count + (next ? 1 : -1));
    Haptics.selectionAsync().catch(() => {});
    (next ? likeWorkout(workoutId) : unlikeWorkout(workoutId)).catch(() => onChange(liked, count));
  };
  return (
    <Pressable
      onPress={toggle}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={liked ? 'Fjern liker' : 'Lik økten'}
      style={styles.button}>
      <Pop trigger={liked}>
        <Icon name={liked ? 'hand.thumbsup.fill' : 'hand.thumbsup'} size={size} color={liked ? theme.accent : theme.text} fallback="👍" />
      </Pop>
      {!hideCount && count > 0 && <ThemedText style={[styles.count, liked && { color: theme.accent }]}>{count}</ThemedText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one, minHeight: 44, minWidth: 44 },
  count: { fontWeight: 600, fontVariant: ['tabular-nums'] },
});
