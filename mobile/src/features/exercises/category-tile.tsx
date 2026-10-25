import { Pressable, StyleSheet, View } from 'react-native';

import { BodyFigure } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { type Category, categoryLoad } from '@/lib/categories';
import { Radius } from '@/theme';

/** Figur for en kategori: muskelfigur med gruppen farget, eller et hjerte for cardio. */
export function CategoryFigure({ category, height }: { category: Category; height: number }) {
  if (category.key === 'CARDIO') {
    return (
      <View style={{ height, justifyContent: 'center' }}>
        <Icon name="heart.fill" size={height * 0.5} color="#E5533D" fallback="♥" />
      </View>
    );
  }
  return (
    <View style={{ height, justifyContent: 'center' }}>
      <BodyFigure side={category.side} load={categoryLoad(category)} height={height} crop={category.crop} />
    </View>
  );
}

/** «Alle øvelser»: hele figuren uten markering. */
export function AllExercisesTile({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Alle øvelser"
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.figure, { backgroundColor: theme.tile }]}>
        <BodyFigure side="front" load={new Map()} height={92} />
      </View>
      <ThemedText style={styles.label} numberOfLines={1}>
        Alle øvelser
      </ThemedText>
    </Pressable>
  );
}

/** Kategori i Utforsk → Øvelser (rutenett med tre kolonner). */
export function CategoryTile({ category, onPress }: { category: Category; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${category.label}, vis øvelser`}
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.figure, { backgroundColor: theme.tile }]}>
        <CategoryFigure category={category} height={92} />
      </View>
      <ThemedText style={styles.label} numberOfLines={1}>
        {category.label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { width: '31%', alignItems: 'center', gap: 8, marginBottom: 20 },
  figure: { width: '100%', aspectRatio: 1, borderRadius: Radius.large, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  label: { fontSize: 16, fontWeight: 600 },
});
