import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme';

/**
 * Bilder i full bredde (kant til kant) med teller («1/2») og prikker. Brukes øverst i
 * øktvisningen og i feedkortene. Trykk åpner fullskjerm.
 */
export function PhotoPager({ uris, height, dots = true }: { uris: string[]; height?: number; dots?: boolean }) {
  const theme = useTheme();
  const { width: screen } = useWindowDimensions();
  const [width, setWidth] = useState(screen);
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  if (uris.length === 0) return null;
  const h = height ?? Math.round(width * 1.1);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <FlatList
        data={uris}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(u, i) => `${i}-${u}`}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => (
          <Pressable
            onPress={() => setViewer(i)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Bilde ${i + 1} av ${uris.length} fra økten. Trykk for fullskjerm.`}>
            <Image source={{ uri: item }} style={{ width, height: h, backgroundColor: theme.backgroundElement }} contentFit="cover" transition={150} />
          </Pressable>
        )}
      />
      {uris.length > 1 && (
        <View style={styles.counter} pointerEvents="none">
          <ThemedText type="smallBold" style={styles.counterText}>
            {index + 1}/{uris.length}
          </ThemedText>
        </View>
      )}
      {dots && uris.length > 1 && (
        <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {uris.map((u, i) => (
            <View key={`${i}-${u}`} style={[styles.dot, { backgroundColor: i === index ? theme.accent : theme.backgroundSelected }]} />
          ))}
        </View>
      )}
      <Fullscreen uris={uris} start={viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

function Fullscreen({ uris, start, onClose }: { uris: string[]; start: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  return (
    <Modal visible={start !== null} animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewer}>
        {start !== null && (
          <FlatList
            data={uris}
            horizontal
            pagingEnabled
            initialScrollIndex={start}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(u, i) => `${i}-${u}`}
            renderItem={({ item }) => <Image source={{ uri: item }} style={{ width, height }} contentFit="contain" />}
          />
        )}
        <SafeAreaView style={styles.viewerBar} pointerEvents="box-none">
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Lukk" style={styles.close}>
            <Icon name="xmark" color="#FFFFFF" fallback="✕" />
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  counter: { position: 'absolute', top: Spacing.three, right: Spacing.three, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  counterText: { color: '#FFFFFF' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: Spacing.two },
  dot: { width: 7, height: 7, borderRadius: 4 },
  viewer: { flex: 1, backgroundColor: '#000000' },
  viewerBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.four },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
