import { Pressable, StyleSheet, View } from 'react-native';

import { BodyFigure } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { exerciseFigure, primaryCategory } from '@/lib/categories';
import { EQUIPMENT_LABELS } from '@/lib/labels';
import { Radius, Spacing } from '@/theme';
import type { Exercise } from '@/types/workout';

type Props = {
  exercise: Exercise;
  onPress: () => void;
  onInfo: () => void;
  onToggleFavorite: () => void;
  layout: 'grid' | 'list';
  /** Fast bredde, f.eks. i en vannrett karusell (standard er halv bredde i rutenett). */
  width?: number;
};

/** Øvelseskort i biblioteket: muskelfigur (primær rød, sekundær blå), bokmerke, «?», navn og kategori. */
export function ExerciseCard({ exercise, onPress, onInfo, onToggleFavorite, layout, width }: Props) {
  const theme = useTheme();
  const { side, load } = exerciseFigure(exercise);
  const category = primaryCategory(exercise)?.label;
  const subtitle = [category, EQUIPMENT_LABELS[exercise.equipment]].filter(Boolean).join(' · ');

  const bookmark = (
    <Pressable
      onPress={onToggleFavorite}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={exercise.favorite ? 'Fjern fra favoritter' : 'Legg til i favoritter'}>
      <Icon name={exercise.favorite ? 'bookmark.fill' : 'bookmark'} size={20} color={theme.text} fallback="🔖" />
    </Pressable>
  );
  const info = (
    <Pressable onPress={onInfo} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Detaljer om ${exercise.name}`}>
      <Icon name="questionmark.circle" size={20} color={theme.textSecondary} fallback="?" />
    </Pressable>
  );

  if (layout === 'list') {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={[styles.rowFigure, { backgroundColor: theme.tile }]}>
          <BodyFigure side={side} load={load} height={58} />
        </View>
        <View style={styles.rowText}>
          <ThemedText style={styles.name} numberOfLines={2}>
            {exercise.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        </View>
        {bookmark}
        {info}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        width !== undefined && { width, marginBottom: 0 },
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
      ]}>
      <View style={[styles.figure, { backgroundColor: theme.tile }]}>
        <BodyFigure side={side} load={load} height={128} />
        <View style={styles.cornerLeft}>{bookmark}</View>
        <View style={styles.cornerRight}>{info}</View>
      </View>
      <View style={styles.text}>
        <ThemedText style={styles.name} numberOfLines={2}>
          {exercise.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '48%', borderRadius: Radius.large, overflow: 'hidden', marginBottom: Spacing.three },
  figure: { height: 150, alignItems: 'center', justifyContent: 'center' },
  cornerLeft: { position: 'absolute', top: 10, left: 10 },
  cornerRight: { position: 'absolute', top: 10, right: 10 },
  text: { padding: Spacing.three, gap: 2, minHeight: 74 },
  name: { fontSize: 16, lineHeight: 20, fontWeight: 600 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  rowFigure: { width: 64, height: 64, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  rowText: { flex: 1, gap: 2 },
});
