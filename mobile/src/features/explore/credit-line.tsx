import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { UserAvatar } from '@/features/social/user-avatar';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/theme';
import type { Credit } from '@/types/explore';

/** Kort tekst til kort: «basert på @kari». */
export function creditShort(c: Credit): string {
  return `basert på ${c.authorUsername ? `@${c.authorUsername}` : c.authorName}`;
}

/**
 * «Basert på «Push/Pull/Legs» av Kari». Vises på kopier og kan ikke fjernes. Trykk åpner
 * profilen til den som laget originalen (når kontoen finnes).
 */
export function CreditLine({ credit }: { credit: Credit }) {
  const theme = useTheme();
  const username = credit.authorUsername;
  const label = `Basert på «${credit.name}» av ${credit.authorName}`;
  const content = (
    <>
      <UserAvatar uri={credit.authorAvatarUrl} size={28} />
      <View style={styles.text}>
        <ThemedText type="small" themeColor="textSecondary">
          Basert på «{credit.name}»
        </ThemedText>
        <ThemedText type="smallBold" numberOfLines={1}>
          av {credit.authorName}
          {username ? <ThemedText type="small" themeColor="textSecondary">{`  @${username}`}</ThemedText> : null}
        </ThemedText>
      </View>
      {username && <Icon name="chevron.right" size={14} color={theme.textSecondary} fallback="›" />}
    </>
  );
  const style = [styles.row, { borderColor: theme.backgroundSelected }];
  if (!username) {
    return (
      <View style={style} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/user/[username]', params: { username } })}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Åpner profilen til den som laget originalen"
      style={({ pressed }) => [...style, { opacity: pressed ? 0.7 : 1 }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 48,
  },
  text: { flex: 1 },
});
