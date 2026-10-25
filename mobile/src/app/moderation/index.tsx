import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formatRelativeDateTime } from '@/lib/stats';
import {
  type ModerationAction,
  REPORT_REASONS,
  type ReportItem,
  TARGET_LABELS,
  fetchReports,
  resolveReport,
  unsuspendUser,
} from '@/services/safety';
import { MaxContentWidth, Radius, Spacing } from '@/theme';

type Status = ReportItem['status'];
const TABS: { value: Status; label: string }[] = [
  { value: 'OPEN', label: 'Åpne' },
  { value: 'RESOLVED', label: 'Behandlet' },
  { value: 'DISMISSED', label: 'Avvist' },
];
const ACTION_LABELS: Record<ModerationAction, string> = {
  DISMISS: 'Avvist',
  REMOVE_CONTENT: 'Innhold fjernet',
  SUSPEND_USER: 'Konto sperret',
};
const reasonLabel = (r: ReportItem['reason']) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;

/** Moderering (bare moderatorer): rapporter med tiltak. Hvert tiltak bekreftes før det utføres. */
export default function ModerationScreen() {
  const theme = useTheme();
  const [status, setStatus] = useState<Status>('OPEN');
  const [items, setItems] = useState<ReportItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /** Henter listen på nytt (etter tiltak og ved dra-for-å-oppdatere). */
  const load = useCallback(
    () =>
      fetchReports(status)
        .then((list) => {
          setError(null);
          setItems(list);
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Kunne ikke hente rapporter')),
    [status],
  );
  useEffect(() => {
    load();
  }, [load]);

  const act = (r: ReportItem, action: ModerationAction) => {
    const what = TARGET_LABELS[r.targetType];
    const text: Record<ModerationAction, [string, string]> = {
      DISMISS: ['Avvise rapporten?', 'Ingen tiltak. Alle åpne rapporter på samme innhold lukkes.'],
      REMOVE_CONTENT: [
        `Fjerne ${what}?`,
        r.targetType === 'COMMENT'
          ? 'Kommentaren slettes.'
          : r.targetType === 'USER'
            ? 'Bio, lenker og profilbilde fjernes.'
            : `${what[0].toUpperCase()}${what.slice(1)} gjøres privat. Eieren beholder det.`,
      ],
      SUSPEND_USER: [`Sperre @${r.targetUsername ?? 'brukeren'}?`, 'Brukeren logges ut, kan ikke logge inn, og innholdet skjules for andre.'],
    };
    Alert.alert(text[action][0], text[action][1], [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Bekreft',
        style: action === 'DISMISS' ? 'default' : 'destructive',
        onPress: () =>
          resolveReport(r.id, action, null)
            .then(load)
            .catch((e: unknown) => Alert.alert('Feilet', e instanceof Error ? e.message : 'Ukjent feil')),
      },
    ]);
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.backgroundGrouped }]}>
      <Stack.Screen options={{ title: 'Moderering' }} />
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable
            key={t.value}
            onPress={() => {
              if (t.value === status) return;
              setItems(null);
              setStatus(t.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: status === t.value }}
            style={[styles.tab, { backgroundColor: status === t.value ? theme.text : theme.backgroundElement }]}>
            <ThemedText type="smallBold" style={{ color: status === t.value ? theme.background : theme.text }}>
              {t.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      {error ? (
        <ThemedText themeColor="textSecondary" style={styles.message}>
          {error}
        </ThemedText>
      ) : items === null ? (
        <ActivityIndicator style={styles.message} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
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
          renderItem={({ item: r }) => (
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.headerRow}>
                <ThemedText type="smallBold" style={styles.flex}>
                  {reasonLabel(r.reason)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatRelativeDateTime(r.createdAt)}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {TARGET_LABELS[r.targetType]} av {r.targetUsername ? `@${r.targetUsername}` : 'slettet bruker'}
                {r.targetSuspended ? ' · sperret' : ''}
                {r.openReportsOnTarget > 1 ? ` · ${r.openReportsOnTarget} rapporter` : ''}
              </ThemedText>
              {r.snapshot && (
                <View style={[styles.snapshot, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText numberOfLines={6}>{r.snapshot}</ThemedText>
                </View>
              )}
              {r.details && <ThemedText type="small">«{r.details}»</ThemedText>}
              <ThemedText type="small" themeColor="textSecondary">
                Rapportert av {r.reporterUsername ? `@${r.reporterUsername}` : 'slettet bruker'}
              </ThemedText>
              {r.status === 'OPEN' ? (
                <View style={styles.actions}>
                  <ActionButton label="Avvis" onPress={() => act(r, 'DISMISS')} />
                  <ActionButton label="Fjern innhold" onPress={() => act(r, 'REMOVE_CONTENT')} danger />
                  {r.targetUserId && !r.targetSuspended && <ActionButton label="Sperr bruker" onPress={() => act(r, 'SUSPEND_USER')} danger />}
                </View>
              ) : (
                <View style={styles.actions}>
                  <ThemedText type="smallBold" style={styles.flex}>
                    {r.action ? ACTION_LABELS[r.action] : ''}
                  </ThemedText>
                  {r.targetSuspended && r.targetUserId && (
                    <ActionButton
                      label="Opphev sperring"
                      onPress={() =>
                        unsuspendUser(r.targetUserId!)
                          .then(load)
                          .catch(() => {})
                      }
                    />
                  )}
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <EmptyState icon="checkmark.shield" title={status === 'OPEN' ? 'Ingen åpne rapporter' : 'Ingenting her ennå'} text={status === 'OPEN' ? 'Alt er behandlet. Bra!' : undefined} />
          }
        />
      )}
    </View>
  );
}

function ActionButton({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.action, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" style={{ color: danger ? theme.danger : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  tabs: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, justifyContent: 'center' },
  tab: { minHeight: 40, paddingHorizontal: Spacing.three, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 60, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  card: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  snapshot: { borderRadius: Radius.medium, padding: Spacing.three },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  action: { minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  message: { textAlign: 'center', marginTop: Spacing.five, paddingHorizontal: Spacing.four },
});
