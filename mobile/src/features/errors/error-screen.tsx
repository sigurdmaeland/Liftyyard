import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { reportError } from '@/services/errors';
import { Spacing } from '@/theme';

/**
 * Vises hvis en skjerm krasjer, i stedet for en hvit skjerm. Feilen rapporteres automatisk,
 * og brukeren kan prøve igjen. Data som er lagret på telefonen er trygge.
 */
export function ErrorScreen({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const theme = useTheme();
  useEffect(() => {
    reportError(error);
  }, [error]);
  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]} accessibilityLiveRegion="assertive">
      <View style={[styles.circle, { backgroundColor: theme.backgroundElement }]}>
        <Icon name="exclamationmark.triangle" size={36} color={theme.textSecondary} fallback="!" />
      </View>
      <ThemedText accessibilityRole="header" style={styles.title}>
        Noe gikk galt
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.text}>
        Vi har fått beskjed om feilen. Øktene og dataene dine er lagret på telefonen.
      </ThemedText>
      <Button label="Prøv igjen" onPress={() => retry()} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  circle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: 700 },
  text: { textAlign: 'center', maxWidth: 320 },
  button: { alignSelf: 'stretch', maxWidth: 320, width: '100%' },
});
