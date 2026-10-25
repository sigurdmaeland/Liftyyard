import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LEVEL_LABELS, ProgramCover } from '@/features/explore/program-cover';
import { creditShort } from '@/features/explore/credit-line';
import { authorLabel } from '@/features/explore/share';
import type { ExploreProgram } from '@/types/explore';

export const CARD_WIDTH = 160;

export function coverTag(p: Pick<ExploreProgram, 'daysPerWeek'>) {
  return p.daysPerWeek ? `${p.daysPerWeek} DAGER/UKE` : undefined;
}

export function downloadsLabel(n: number) {
  return `${n.toLocaleString('nb-NO')} ${n === 1 ? 'nedlasting' : 'nedlastinger'}`;
}

/** Programkort i Utforsk-karusellene og på profiler. */
export function ExploreProgramCard({ program }: { program: ExploreProgram }) {
  const details = [program.level ? LEVEL_LABELS[program.level] : null, downloadsLabel(program.downloadCount)].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/explore/program/[id]', params: { id: program.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${program.name} av ${authorLabel(program.author)}, ${downloadsLabel(program.downloadCount)}`}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.8 : 1 }]}>
      <ProgramCover id={program.id} title={program.name} tag={coverTag(program)} size={CARD_WIDTH} />
      <ThemedText style={styles.name} numberOfLines={2}>
        {program.name}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {program.mine ? 'av deg' : `av ${authorLabel(program.author)}`}
        {program.basedOn ? `, ${creditShort(program.basedOn)}` : ''}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {details}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, gap: 2 },
  name: { fontSize: 16, lineHeight: 20, fontWeight: 600, marginTop: 8 },
});
