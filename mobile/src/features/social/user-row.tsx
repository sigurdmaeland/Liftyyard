import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { FollowButton } from '@/features/social/follow-button';
import { UserAvatar } from '@/features/social/user-avatar';
import { useTheme } from '@/hooks/use-theme';
import type { FollowStatus, UserSummary } from '@/services/social';
import { Spacing } from '@/theme';

/** En bruker i søk og lister: bilde, navn, @brukernavn og følg-knapp (eller egne knapper i `right`). */
export function UserRow({
  user,
  onStatusChange,
  right,
}: {
  user: UserSummary;
  onStatusChange?: (status: FollowStatus) => void;
  right?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/user/[username]', params: { username: user.username } })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <UserAvatar uri={user.avatarUrl} size={48} />
      <View style={styles.text}>
        <View style={styles.nameRow}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {user.displayName}
          </ThemedText>
          {user.isPrivate && <Icon name="lock.fill" size={12} color={theme.textSecondary} fallback="🔒" />}
        </View>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          @{user.username}
        </ThemedText>
      </View>
      {right ??
        (!user.isSelf && onStatusChange && (
          <FollowButton username={user.username} status={user.followStatus} onChange={onStatusChange} compact />
        ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  text: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontWeight: 600, flexShrink: 1 },
});
