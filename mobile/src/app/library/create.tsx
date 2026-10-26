import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { createProgram, createRoutine } from '@/storage/program-store';
import { Spacing } from '@/theme';

/** «+» i Bibliotek: velg hva du vil lage. */
export default function CreateSheet() {
  const db = useSQLiteContext();

  const program = async () => {
    const id = await createProgram(db);
    router.replace({ pathname: '/program/edit', params: { id, isNew: '1' } });
  };
  const routine = async () => {
    const id = await createRoutine(db, null);
    router.replace({ pathname: '/routine/[id]', params: { id } });
  };

  return (
    <ThemedView style={styles.sheet}>
      <Option icon="folder" title="Program" subtitle="Lag et program med rutinene dine" onPress={program} />
      <Option icon="doc.text" title="Rutine" subtitle="Lag en gjenbrukbar treningsrutine" onPress={routine} />
      <Option icon="dumbbell" title="Øvelse" subtitle="Lag en egendefinert øvelse" onPress={() => router.replace('/exercise/edit')} />
    </ThemedView>
  );
}

function Option({ icon, title, subtitle, onPress }: { icon: SFSymbol; title: string; subtitle: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={[styles.circle, { backgroundColor: theme.backgroundSelected }]}>
        <Icon name={icon} size={26} color={theme.text} fallback="+" />
      </View>
      <View style={styles.text}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingTop: Spacing.four, paddingBottom: Spacing.five, paddingHorizontal: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  circle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: 500 },
});
