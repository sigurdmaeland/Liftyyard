import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { type FollowStatus, followUser, unfollowUser } from '@/services/social';

const LABELS: Record<FollowStatus, string> = { NONE: 'Følg', PENDING: 'Forespurt', FOLLOWING: 'Følger' };

/**
 * Følg-knapp: «Følg» → «Følger» (eller «Forespurt» for private profiler). Trykk på «Følger»/«Forespurt»
 * spør før man slutter å følge eller trekker tilbake forespørselen. Krever nett.
 */
export function FollowButton({
  username,
  status,
  followsYou = false,
  onChange,
  compact = false,
}: {
  username: string;
  status: FollowStatus;
  followsYou?: boolean;
  onChange: (status: FollowStatus) => void;
  compact?: boolean;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<FollowStatus>) => {
    setBusy(true);
    try {
      onChange(await action());
    } catch (e) {
      Alert.alert('Det gikk ikke', e instanceof Error ? e.message : 'Prøv igjen når du har nett.');
    } finally {
      setBusy(false);
    }
  };

  const press = () => {
    if (status === 'NONE') {
      run(() => followUser(username));
      return;
    }
    Alert.alert(status === 'FOLLOWING' ? `Slutte å følge @${username}?` : 'Trekke tilbake forespørselen?', undefined, [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: status === 'FOLLOWING' ? 'Slutt å følge' : 'Trekk tilbake',
        style: 'destructive',
        onPress: () => run(async () => (await unfollowUser(username), 'NONE')),
      },
    ]);
  };

  const primary = status === 'NONE';
  const label = primary && followsYou ? 'Følg tilbake' : LABELS[status];
  return (
    <Pressable
      onPress={press}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`${label} @${username}`}
      style={[
        styles.button,
        compact && styles.compact,
        primary ? { backgroundColor: theme.accentFill } : { backgroundColor: theme.backgroundElement },
      ]}>
      {busy ? (
        <ActivityIndicator color={primary ? '#FFFFFF' : theme.text} />
      ) : (
        <ThemedText type="smallBold" style={[styles.label, { color: primary ? '#FFFFFF' : theme.text }]}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, paddingHorizontal: 20, borderRadius: 20, alignItems: 'center', justifyContent: 'center', minWidth: 110 },
  compact: { minHeight: 40, paddingHorizontal: 14, minWidth: 92, borderRadius: 17 },
  label: { fontSize: 16 },
});
