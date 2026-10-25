import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { UserListScreen } from '@/features/social/user-list-screen';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { fetchFollowers, removeFollower } from '@/services/social';

/** Følgerne til en bruker. På din egen liste kan du fjerne følgere. */
export default function FollowersScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const me = useProfile();
  const theme = useTheme();
  const load = useCallback(() => fetchFollowers(username), [username]);
  const isMine = me.username === username;

  return (
    <UserListScreen
      title="Følgere"
      load={load}
      empty="Ingen følgere ennå."
      renderRight={
        isMine
          ? (user, remove) => (
              <Pressable
                onPress={() =>
                  Alert.alert(`Fjerne @${user.username} som følger?`, 'Brukeren får ikke beskjed.', [
                    { text: 'Avbryt', style: 'cancel' },
                    {
                      text: 'Fjern',
                      style: 'destructive',
                      onPress: () =>
                        removeFollower(user.username)
                          .then(remove)
                          .catch(() => Alert.alert('Det gikk ikke', 'Prøv igjen når du har nett.')),
                    },
                  ])
                }
                accessibilityRole="button"
                style={[styles.button, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">Fjern</ThemedText>
              </Pressable>
            )
          : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center' },
});
