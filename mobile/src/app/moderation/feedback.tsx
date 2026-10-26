import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formatRelativeDateTime } from '@/lib/stats';
import { type FeedbackItem, type FeedbackKind, fetchFeedback, markFeedbackDone } from '@/services/feedback';
import { MaxContentWidth, Radius, Spacing } from '@/theme';

const KIND_LABELS: Record<FeedbackKind, string> = { BUG: 'Feil', IDEA: 'Forslag', SUPPORT: 'Support' };

/** Tilbakemeldinger fra «Få hjelp» (bare moderatorer). Support-saker besvares på e-post fra kontoen. */
export default function FeedbackModerationScreen() {
  const theme = useTheme();
  const [status, setStatus] = useState<'OPEN' | 'DONE'>('OPEN');
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      fetchFeedback(status)
        .then((list) => {
          setError(null);
          setItems(list);
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Kunne ikke hente tilbakemeldinger')),
    [status],
  );
  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <FlatList
        data={items ?? []}
        keyExtractor={(f) => f.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load().finally(() => setRefreshing(false));
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.tabs} accessibilityRole="tablist">
            {(['OPEN', 'DONE'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => setStatus(s)}
                accessibilityRole="tab"
                accessibilityState={{ selected: status === s }}
                style={[styles.tab, { backgroundColor: status === s ? theme.text : theme.backgroundElement }]}>
                <ThemedText type="smallBold" style={{ color: status === s ? theme.background : theme.text }}>
                  {s === 'OPEN' ? 'Åpne' : 'Behandlet'}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        }
        ListEmptyComponent={
          error ? (
            <ThemedText themeColor="textSecondary">{error}</ThemedText>
          ) : items ? (
            <EmptyState icon="tray" title="Ingen tilbakemeldinger" text={status === 'OPEN' ? 'Alt er behandlet.' : 'Ingenting her ennå.'} />
          ) : undefined
        }
        renderItem={({ item: f }) => (
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {KIND_LABELS[f.kind]} · {f.username ? `@${f.username}` : f.displayName} · {formatRelativeDateTime(f.createdAt)}
            </ThemedText>
            <ThemedText>{f.message}</ThemedText>
            {(f.appVersion || f.platform) && (
              <ThemedText type="small" themeColor="textSecondary">
                {[f.appVersion && `Versjon ${f.appVersion}`, f.platform].filter(Boolean).join(' · ')}
              </ThemedText>
            )}
            {f.status === 'OPEN' && (
              <Pressable
                onPress={() => markFeedbackDone(f.id).then(load)}
                accessibilityRole="button"
                style={[styles.done, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold">Marker som behandlet</ThemedText>
              </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: Spacing.four, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  tabs: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
  tab: { minHeight: 36, paddingHorizontal: Spacing.three, borderRadius: 18, justifyContent: 'center' },
  card: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  done: { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: Spacing.three, borderRadius: 20, justifyContent: 'center' },
});
