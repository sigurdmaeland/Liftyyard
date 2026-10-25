import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/theme';

/**
 * Bilder fra en økt i full bredde, sveip mellom dem (prikker viser hvor man er).
 * Trykk på et bilde for å se det i fullskjerm.
 */
export function PhotoCarousel({ uris, aspect = 4 / 3, rounded = true }: { uris: string[]; aspect?: number; rounded?: boolean }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  if (uris.length === 0) return null;
  const height = width / aspect;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <FlatList
          data={uris}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(u, i) => `${i}-${u}`}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <Pressable onPress={() => setViewer(i)} accessibilityRole="imagebutton" accessibilityLabel={`Bilde ${i + 1} av ${uris.length}. Trykk for fullskjerm.`}>
              <Image
                source={{ uri: item }}
                style={[{ width, height, backgroundColor: theme.backgroundElement }, rounded && styles.rounded]}
                contentFit="cover"
                transition={150}
              />
            </Pressable>
          )}
        />
      )}
      {uris.length > 1 && (
        <View style={styles.dots}>
          {uris.map((u, i) => (
            <View key={`${i}-${u}`} style={[styles.dot, { backgroundColor: i === index ? theme.text : theme.backgroundSelected }]} />
          ))}
        </View>
      )}
      <FullscreenViewer uris={uris} start={viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

function FullscreenViewer({ uris, start, onClose }: { uris: string[]; start: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  return (
    <Modal visible={start !== null} animationType="fade" onRequestClose={onClose} onShow={() => setIndex(start ?? 0)} transparent={false}>
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
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => <Image source={{ uri: item }} style={{ width, height }} contentFit="contain" />}
          />
        )}
        <SafeAreaView style={styles.viewerBar} pointerEvents="box-none">
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Lukk" style={styles.close}>
            <Icon name="xmark" color="#FFFFFF" fallback="✕" />
          </Pressable>
          {uris.length > 1 && (
            <ThemedText style={styles.counter}>
              {index + 1} / {uris.length}
            </ThemedText>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rounded: { borderRadius: Radius.medium },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: Spacing.two },
  dot: { width: 7, height: 7, borderRadius: 4 },
  viewer: { flex: 1, backgroundColor: '#000000' },
  viewerBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  counter: { color: '#FFFFFF', fontWeight: 600 },
});
