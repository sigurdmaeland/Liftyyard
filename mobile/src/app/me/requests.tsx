import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { UserListScreen } from '@/features/social/user-list-screen';
import { useTheme } from '@/hooks/use-theme';
import { acceptFollowRequest, declineFollowRequest, fetchFollowRequests } from '@/services/social';
import { Spacing } from '@/theme';

/** Forespørsler om å følge deg (når profilen er privat). */
export default function FollowRequestsScreen() {
  const theme = useTheme();
  const act = (action: () => Promise<void>, remove: () => void) =>
    action()
      .then(remove)
      .catch(() => Alert.alert('Det gikk ikke', 'Prøv igjen når du har nett.'));

  return (
    <UserListScreen
      title="Følgeforespørsler"
      load={fetchFollowRequests}
      empty="Ingen forespørsler."
      renderRight={(user, remove) => (
        <View style={styles.buttons}>
          <Pressable
            onPress={() => act(() => acceptFollowRequest(user.username), remove)}
            accessibilityRole="button"
            accessibilityLabel={`Godta @${user.username}`}
            style={[styles.button, { backgroundColor: theme.accentFill }]}>
            <ThemedText type="smallBold" style={styles.accept}>
              Godta
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => act(() => declineFollowRequest(user.username), remove)}
            accessibilityRole="button"
            accessibilityLabel={`Avslå @${user.username}`}
            style={[styles.button, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">Avslå</ThemedText>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: Spacing.two },
  button: { minHeight: 44, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center' },
  accept: { color: '#FFFFFF' },
});
