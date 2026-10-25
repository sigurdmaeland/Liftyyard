import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { downloadsLabel } from '@/features/explore/program-card';
import { creditShort } from '@/features/explore/credit-line';
import { authorLabel } from '@/features/explore/share';
import { UserAvatar } from '@/features/social/user-avatar';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/theme';
import type { ExploreRoutine } from '@/types/explore';

export const ROUTINE_CARD_WIDTH = 250;
const PREVIEW = 4;

/** Rutinekort i Utforsk og på profiler: forfatter, de første øvelsene og antall nedlastinger. */
export function ExploreRoutineCard({ routine, width = ROUTINE_CARD_WIDTH }: { routine: ExploreRoutine; width?: number | '100%' }) {
  const theme = useTheme();
  const rest = routine.preview.length - PREVIEW;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/explore/routine/[id]', params: { id: routine.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Rutine ${routine.name} av ${authorLabel(routine.author)}, ${routine.exerciseCount} øvelser`}
      style={({ pressed }) => [styles.card, { width, backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 }]}>
      <View style={styles.author}>
        <UserAvatar uri={routine.author.avatarUrl} size={24} />
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
          {routine.mine ? 'Din rutine' : authorLabel(routine.author)}
          {routine.basedOn ? ` · ${creditShort(routine.basedOn)}` : ''}
        </ThemedText>
      </View>
      <ThemedText style={styles.name} numberOfLines={1}>
        {routine.name}
      </ThemedText>
      <View style={styles.lines}>
        {routine.preview.slice(0, PREVIEW).map((e, i) => (
          <ThemedText key={`${e.name}-${i}`} type="small" numberOfLines={1}>
            <ThemedText type="smallBold">{e.setCount} × </ThemedText>
            {e.name}
          </ThemedText>
        ))}
        {rest > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            + {rest} til
          </ThemedText>
        )}
        {routine.preview.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Ingen øvelser
          </ThemedText>
        )}
      </View>
      <View style={styles.footer}>
        <Icon name="arrow.down.circle" size={14} color={theme.textSecondary} fallback="↓" />
        <ThemedText type="small" themeColor="textSecondary">
          {downloadsLabel(routine.downloadCount)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Radius.large, gap: Spacing.two },
  author: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  name: { fontSize: 18, lineHeight: 23, fontWeight: 700 },
  lines: { gap: 2, minHeight: 84 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
