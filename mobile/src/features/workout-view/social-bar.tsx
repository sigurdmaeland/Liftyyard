import { router } from 'expo-router';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { LikeButton } from '@/features/social/like-button';
import { useTheme } from '@/hooks/use-theme';
import { formatVolume } from '@/lib/format';

type Social = { id: string; name: string; volumeKg: number; likeCount: number; likedByMe: boolean; commentCount: number };

export function openComments(workoutId: string, focus = false) {
  router.push({ pathname: '/post/[id]/comments', params: { id: workoutId, ...(focus ? { focus: '1' } : {}) } });
}

/** Deler en tekstoppsummering av økten via telefonens delingsark. */
export function shareWorkout(w: { name: string; volumeKg: number }, author?: string) {
  const who = author ? `${author}: ` : '';
  Share.share({ message: `${who}${w.name} – ${formatVolume(w.volumeKg)} løftet. Logget i Treningsapp.` }).catch(() => {});
}

/** «Vær den første som liker!» / «3 liker» til venstre, «2 kommentarer» til høyre. */
export function SocialSummary({ item }: { item: Social }) {
  return (
    <View style={styles.summary}>
      <Pressable
        onPress={() => item.likeCount > 0 && router.push({ pathname: '/post/[id]/likes', params: { id: item.id } })}
        disabled={item.likeCount === 0}
        accessibilityRole="button"
        accessibilityHint={item.likeCount > 0 ? 'Viser hvem som liker økten' : undefined}
        hitSlop={8}>
        <ThemedText type="small">
          {item.likeCount === 0 ? 'Vær den første som liker!' : `${item.likeCount} ${item.likeCount === 1 ? 'liker' : 'likere'}`}
        </ThemedText>
      </Pressable>
      {item.commentCount > 0 && (
        <Pressable onPress={() => openComments(item.id)} accessibilityRole="button" hitSlop={8}>
          <ThemedText type="small">
            {item.commentCount} {item.commentCount === 1 ? 'kommentar' : 'kommentarer'}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

/** Liker, kommenter og del – jevnt fordelt over hele bredden. */
export function ActionBar({ item, author, onChange }: { item: Social; author?: string; onChange?: (liked: boolean, count: number) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.actions}>
      <View style={styles.cell}>
        <LikeButton workoutId={item.id} liked={item.likedByMe} count={item.likeCount} onChange={(l, c) => onChange?.(l, c)} hideCount />
      </View>
      <Pressable onPress={() => openComments(item.id, true)} accessibilityRole="button" accessibilityLabel="Kommenter" style={styles.cell}>
        <Icon name="bubble.left" size={24} color={theme.text} fallback="💬" />
      </Pressable>
      <Pressable onPress={() => shareWorkout(item, author)} accessibilityRole="button" accessibilityLabel="Del økten" style={styles.cell}>
        <Icon name="arrowshape.turn.up.right" size={24} color={theme.text} fallback="↗" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
