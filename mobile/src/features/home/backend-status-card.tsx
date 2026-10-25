import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { API_URL } from '@/services/api';
import { fetchHealth, type HealthResponse } from '@/services/health';
import { Radius, Spacing } from '@/theme';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; health: HealthResponse }
  | { kind: 'error'; message: string };

/** Viser om appen får kontakt med backend og databasen. Brukes under utvikling. */
export function BackendStatusCard() {
  const theme = useTheme();
  const [state, setState] = useState<State>({ kind: 'loading' });

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    fetchHealth()
      .then((health) => active && setState({ kind: 'ok', health }))
      .catch((error: unknown) =>
        active && setState({ kind: 'error', message: error instanceof Error ? error.message : 'Ukjent feil' }),
      );
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = () => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  const healthy = state.kind === 'ok' && state.health.status === 'UP' && state.health.database === 'UP';
  const dotColor = state.kind === 'loading' ? theme.textSecondary : healthy ? theme.success : theme.danger;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <ThemedText type="smallBold">Backend</ThemedText>
        {state.kind === 'loading' && <ActivityIndicator size="small" />}
      </View>

      {state.kind === 'ok' && (
        <ThemedText type="small" themeColor="textSecondary">
          Server: {state.health.status} · Database: {state.health.database} · v{state.health.version}
        </ThemedText>
      )}
      {state.kind === 'error' && (
        <ThemedText type="small" themeColor="textSecondary">
          {state.message}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {API_URL}
      </ThemedText>

      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}>
        <ThemedText type="smallBold">Sjekk på nytt</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.large,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 10, height: 10, borderRadius: 5 },
  button: {
    alignSelf: 'flex-start',
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
  },
});
