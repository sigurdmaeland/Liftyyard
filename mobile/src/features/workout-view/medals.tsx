import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { MEDAL_NAMES, type Medal, RECORD_DESCRIPTIONS, RECORD_LABELS, type SetRecord } from '@/lib/records';

/** Egne medaljefarger (gull, sølv, bronse). Formen (ikonet) og teksten bærer betydningen, ikke bare fargen. */
export const MEDAL_COLORS: Record<Medal, string> = { 1: '#E0A82E', 2: '#A7AFBA', 3: '#C27C4A' };

export function MedalIcon({ medal, size = 18 }: { medal: Medal; size?: number }) {
  return <Icon name="medal.fill" size={size} color={MEDAL_COLORS[medal]} fallback="🏅" />;
}

/** «🏅 1RM» – én rekord på et sett. */
export function RecordChip({ record }: { record: SetRecord }) {
  return (
    <View style={styles.chip} accessible accessibilityLabel={`Rekord, ${RECORD_DESCRIPTIONS[record.kind]}, ${MEDAL_NAMES[record.medal]}`}>
      <MedalIcon medal={record.medal} size={14} />
      <ThemedText type="small" themeColor="textSecondary">
        {RECORD_LABELS[record.kind]}
      </ThemedText>
    </View>
  );
}

/** Medaljene som finnes i økten (én av hver farge) og totalt antall rekorder. */
export function RecordSummary({ medals, count, size = 20 }: { medals: Medal[]; count: number; size?: number }) {
  return (
    <View style={styles.summary} accessible accessibilityLabel={`${count} ${count === 1 ? 'rekord' : 'rekorder'}`}>
      <View style={styles.icons}>
        {medals.map((m) => (
          <MedalIcon key={m} medal={m} size={size} />
        ))}
      </View>
      <ThemedText style={styles.count}>{count}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icons: { flexDirection: 'row', gap: -4 },
  count: { fontSize: 18, lineHeight: 24, fontWeight: 700, fontVariant: ['tabular-nums'] },
});
