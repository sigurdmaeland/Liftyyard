import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { SyncStatus } from '@/types/workout';

const LABELS: Record<SyncStatus, string> = {
  local: 'Kun på telefonen',
  pending: 'Venter på synk',
  synced: 'Synkronisert',
  failed: 'Synk feilet',
};

export function SyncBadge({ status }: { status: SyncStatus }) {
  const theme = useTheme();
  const color = status === 'synced' ? theme.success : status === 'failed' ? theme.danger : theme.textSecondary;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {LABELS[status]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
