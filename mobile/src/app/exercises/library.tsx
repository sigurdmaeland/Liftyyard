import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedView } from '@/components/themed-view';
import { ExerciseLibrary } from '@/features/exercises/exercise-library';
import { useTheme } from '@/hooks/use-theme';

/** Øvelsesbiblioteket (fra Utforsk/Bibliotek). ?category=<nøkkel> åpner en kategori, ?focus=1 åpner søket. */
export default function ExerciseLibraryScreen() {
  const { category, focus } = useLocalSearchParams<{ category?: string; focus?: string }>();
  const theme = useTheme();
  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <ExerciseLibrary
          initialCategory={category}
          autoFocusSearch={focus === '1'}
          onSelect={(e) => router.push({ pathname: '/exercise/[id]', params: { id: e.id } })}
          leading={
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Tilbake">
              <Icon name="chevron.left" size={22} color={theme.text} fallback="‹" />
            </Pressable>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
