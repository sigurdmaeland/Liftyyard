import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { UserAvatar } from '@/features/social/user-avatar';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme';
import type { Author } from '@/types/explore';

/** «Laget av» med bilde og navn. Trykk åpner profilen (ikke for appens egne programmer). */
export function AuthorRow({ author, mine }: { author: Author; mine?: boolean }) {
  const theme = useTheme();
  const username = author.username;
  const content = (
    <>
      <UserAvatar uri={author.avatarUrl} size={36} />
      <View style={styles.text}>
        <ThemedText type="small" themeColor="textSecondary">
          {mine ? 'Laget av deg' : 'Laget av'}
        </ThemedText>
        <ThemedText type="smallBold" numberOfLines={1}>
          {author.displayName}
          {username ? <ThemedText type="small" themeColor="textSecondary">{`  @${username}`}</ThemedText> : null}
        </ThemedText>
      </View>
      {username && !mine && <Icon name="chevron.right" size={14} color={theme.textSecondary} fallback="›" />}
    </>
  );
  if (!username || mine) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/user/[username]', params: { username } })}
      accessibilityRole="button"
      accessibilityLabel={`Laget av ${author.displayName}. Åpne profilen.`}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  text: { flex: 1 },
});
